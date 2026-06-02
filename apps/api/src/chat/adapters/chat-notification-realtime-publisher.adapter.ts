import { Injectable } from '@nestjs/common';
import type { NotificationRealtimePublisherPort } from '../../notifications/notifications.tokens.js';
import { CHAT_REALTIME_EVENT_NAME } from '../realtime/chat-realtime.constants.js';
import { ChatRealtimePublisher } from '../realtime/chat-realtime-publisher.js';

@Injectable()
export class ChatNotificationRealtimePublisherAdapter implements NotificationRealtimePublisherPort {
  constructor(private readonly publisher: ChatRealtimePublisher) {}

  isBound(): boolean {
    return this.publisher.isBound();
  }

  publishNotificationCreated(input: { recipientUserId: string; event: unknown }): void {
    this.publisher.publishToUserRoom({
      userId: input.recipientUserId,
      eventName: CHAT_REALTIME_EVENT_NAME,
      payload: input.event,
    });
  }
}
