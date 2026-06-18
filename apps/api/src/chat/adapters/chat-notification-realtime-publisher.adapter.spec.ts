import { describe, expect, it, vi } from 'vitest';
import { CHAT_REALTIME_EVENT_NAME } from '../realtime/chat-realtime.constants.js';
import { ChatNotificationRealtimePublisherAdapter } from './chat-notification-realtime-publisher.adapter.js';

describe('ChatNotificationRealtimePublisherAdapter', () => {
  it('notification.created event를 기존 chat realtime user room event channel로 위임한다', () => {
    const publisher = {
      isBound: vi.fn(() => true),
      publishToUserRoom: vi.fn(),
    };
    const adapter = new ChatNotificationRealtimePublisherAdapter(publisher);

    expect(adapter.isBound()).toBe(true);
    adapter.publishNotificationCreated({
      recipientUserId: 'user-b',
      event: { eventType: 'notification.created' },
    });

    expect(publisher.publishToUserRoom).toHaveBeenCalledWith({
      userId: 'user-b',
      eventName: CHAT_REALTIME_EVENT_NAME,
      payload: { eventType: 'notification.created' },
    });
  });
});
