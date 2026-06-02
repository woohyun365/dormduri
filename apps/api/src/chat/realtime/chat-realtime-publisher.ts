import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type {
  ChatRealtimeOutboxRecipient,
  ClaimedChatRealtimeOutboxEvent,
} from '../outbox/chat-realtime-outbox.repository.js';
import {
  CHAT_REALTIME_EVENT_NAME,
  chatRealtimeThreadRoom,
  chatRealtimeUserRoom,
} from './chat-realtime.constants.js';
import {
  type ChatRealtimeEventType,
  toChatRealtimeEventEnvelope,
} from './chat-realtime-event.mapper.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class ChatRealtimePublisher {
  private server: Server | null = null;

  bindServer(server: Server) {
    this.server = server;
  }

  isBound() {
    return this.server !== null;
  }

  publishToUserRoom(input: { userId: string; eventName: string; payload: unknown }): void {
    if (!this.server) {
      throw new Error('[ChatRealtimePublisher] server is not bound');
    }

    this.server.to(chatRealtimeUserRoom(input.userId)).emit(input.eventName, input.payload);
  }

  publishOutboxEvent(input: {
    event: ClaimedChatRealtimeOutboxEvent;
    recipients: ChatRealtimeOutboxRecipient[];
  }): void {
    if (!this.server) {
      throw new Error('[ChatRealtimePublisher] server is not bound');
    }

    const recipientUserIds = new Set(input.recipients.map((recipient) => recipient.userId));
    const recipientByUserId = new Map(
      input.recipients.map((recipient) => [recipient.userId, recipient]),
    );

    for (const recipient of input.recipients) {
      this.server
        .to(chatRealtimeUserRoom(recipient.userId))
        .emit(CHAT_REALTIME_EVENT_NAME, this.toEnvelope(input.event, recipient.cursor));
    }

    for (const roomKey of input.event.roomKeys) {
      if (roomKey.startsWith('user:')) {
        const userId = roomKey.slice('user:'.length);
        if (recipientUserIds.has(userId)) {
          continue;
        }

        const cursor = recipientByUserId.get(userId)?.cursor ?? input.event.id;
        this.server
          .to(roomKey)
          .emit(CHAT_REALTIME_EVENT_NAME, this.toEnvelope(input.event, cursor));
        continue;
      }

      this.server
        .to(roomKey)
        .emit(CHAT_REALTIME_EVENT_NAME, this.toEnvelope(input.event, input.event.id));
    }

    this.applyRoomSideEffects(input.event);
  }

  private toEnvelope(event: ClaimedChatRealtimeOutboxEvent, cursor: string) {
    if (event.schemaVersion !== 1) {
      throw new Error('[ChatRealtimePublisher] unsupported schema version');
    }

    return toChatRealtimeEventEnvelope({
      schemaVersion: 1,
      eventId: event.id,
      eventType: event.eventType as ChatRealtimeEventType,
      occurredAt: event.occurredAt,
      cursor,
      threadId: event.threadId,
      payload: event.payload,
    });
  }

  private applyRoomSideEffects(event: ClaimedChatRealtimeOutboxEvent) {
    if (!this.server || event.eventType !== 'chat.member.left') {
      return;
    }

    if (!isRecord(event.payload)) {
      return;
    }

    const userId = event.payload.userId;
    const threadId = event.payload.threadId;
    if (typeof userId !== 'string' || typeof threadId !== 'string') {
      return;
    }

    this.server.in(chatRealtimeUserRoom(userId)).socketsLeave(chatRealtimeThreadRoom(threadId));
  }
}
