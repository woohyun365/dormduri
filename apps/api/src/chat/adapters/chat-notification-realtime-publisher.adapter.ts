import { Inject, Injectable } from '@nestjs/common';
import type { NotificationRealtimePublisherPort } from '../../notifications/application/ports/notification-realtime-publisher.port.js';
import {
  REALTIME_USER_ROOM_PUBLISHER_PORT,
  type RealtimeUserRoomPublisherPort,
} from '../../realtime/realtime.tokens.js';
import { CHAT_REALTIME_EVENT_NAME } from '../realtime/chat-realtime.constants.js';

@Injectable()
export class ChatNotificationRealtimePublisherAdapter implements NotificationRealtimePublisherPort {
  constructor(
    @Inject(REALTIME_USER_ROOM_PUBLISHER_PORT)
    private readonly publisher: RealtimeUserRoomPublisherPort,
  ) {}

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
