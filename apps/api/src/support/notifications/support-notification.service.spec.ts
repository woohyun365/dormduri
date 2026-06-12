import { describe, expect, it, vi, type Mocked } from 'vitest';
import { SupportNotificationService } from './support-notification.service.js';
import type { NotificationWriterPort } from '../../notifications/application/ports/notification-writer.port.js';

describe('SupportNotificationService', () => {
  it('ticket 생성 알림은 pointer/status payload만 writer에 넘긴다', async () => {
    const writer: Mocked<NotificationWriterPort> = {
      appendNotification: vi
        .fn()
        .mockResolvedValue({ notificationId: 'notification-1', created: true }),
    };
    const service = new SupportNotificationService(writer);
    const tx = {} as never;

    await service.appendTicketCreated({
      tx,
      requesterUserId: 'user-1',
      supportTicketId: 'ticket-1',
      category: 'BUG',
      occurredAt: new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(writer.appendNotification.mock.calls[0]).toEqual([
      tx,
      expect.objectContaining({
        recipientUserId: 'user-1',
        actorUserId: 'user-1',
        kind: 'SUPPORT_TICKET_CREATED',
        sourceType: 'SUPPORT_TICKET',
        sourceId: 'ticket-1',
        payload: {
          kind: 'SUPPORT_TICKET_CREATED',
          supportTicketId: 'ticket-1',
          category: 'BUG',
          status: 'OPEN',
          occurredAt: '2026-06-08T00:00:00.000Z',
        },
      }),
    ]);
  });

  it('operator reply 알림은 body/email 없이 ticket status만 전달한다', async () => {
    const writer: Mocked<NotificationWriterPort> = {
      appendNotification: vi
        .fn()
        .mockResolvedValue({ notificationId: 'notification-1', created: true }),
    };
    const service = new SupportNotificationService(writer);
    const tx = {} as never;

    await service.appendTicketReplied({
      tx,
      requesterUserId: 'user-1',
      operatorUserId: 'operator-1',
      supportTicketId: 'ticket-1',
      status: 'WAITING_USER',
      occurredAt: new Date('2026-06-08T00:00:00.000Z'),
    });

    const payload = writer.appendNotification.mock.calls[0]?.[1].payload;
    expect(payload).toEqual({
      kind: 'SUPPORT_TICKET_REPLIED',
      supportTicketId: 'ticket-1',
      status: 'WAITING_USER',
      occurredAt: '2026-06-08T00:00:00.000Z',
    });
    expect(payload).not.toHaveProperty('body');
    expect(payload).not.toHaveProperty('email');
  });
});
