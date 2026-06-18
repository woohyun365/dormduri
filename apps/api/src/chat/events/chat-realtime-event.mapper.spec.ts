import { describe, expect, it } from 'vitest';
import {
  assertChatRealtimePayloadAllowed,
  isChatRealtimePayloadPrivacySafe,
  toChatMessageCreatedPayload,
  toChatMessageTombstonedPayload,
  toChatRealtimeEventEnvelope,
} from './chat-realtime-event.mapper.js';

describe('chat realtime event mapper', () => {
  it('message created payload는 allowlist 필드만 생성한다', () => {
    const sentAt = new Date('2026-02-10T03:00:00.000Z');

    const payload = toChatMessageCreatedPayload({
      id: 'message-1',
      senderUserId: 'user-1',
      body: '안녕하세요',
      bodyState: 'PLAIN',
      tombstoneReason: null,
      bodyVersion: 1,
      sentAt,
    });

    expect(payload).toEqual({
      message: {
        id: 'message-1',
        senderUserId: 'user-1',
        body: '안녕하세요',
        bodyState: 'PLAIN',
        tombstoneReason: null,
        bodyVersion: 1,
        sentAt: sentAt.toISOString(),
      },
    });
    expect(JSON.stringify(payload)).not.toContain('retainedVaultObject');
  });

  it('tombstone payload는 retained original body를 거부한다', () => {
    const payload = toChatMessageTombstonedPayload({
      messageId: 'message-1',
      body: '보존 처리된 메시지입니다.',
      bodyState: 'TOMBSTONED',
      tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
      bodyVersion: 2,
    });

    expect(payload).not.toHaveProperty('retainedOriginalBody');
    expect(() =>
      assertChatRealtimePayloadAllowed({
        ...payload,
        retainedOriginalBody: '노출되면 안 되는 원문',
      }),
    ).toThrow(/forbidden payload key/);
  });

  it('replay envelope 생성 전 vault/audit/internal payload를 privacy guard로 차단한다', () => {
    expect(
      isChatRealtimePayloadPrivacySafe({
        message: {
          id: 'message-1',
          retainedVaultPayload: { body: '원문' },
        },
      }),
    ).toBe(false);
    expect(() =>
      toChatRealtimeEventEnvelope({
        schemaVersion: 1,
        eventId: 'event-1',
        eventType: 'chat.message.created',
        occurredAt: new Date('2026-02-10T03:00:00.000Z'),
        cursor: 'cursor-1',
        threadId: 'thread-1',
        payload: {
          message: {
            id: 'message-1',
            retainedVaultObjectId: 'vault-object-1',
          },
        },
      }),
    ).toThrow(/forbidden payload key/);
  });

  it.each([
    ['rawRetainedBody', '원문'],
    ['internalAuditData', { reason: '운영 내부 정보' }],
    ['retainedVaultPayload', { body: '보존 vault payload' }],
  ])('payload Json에 %s가 들어가면 privacy guard가 차단한다', (key, value) => {
    expect(
      isChatRealtimePayloadPrivacySafe({
        message: {
          id: 'message-1',
          [key]: value,
        },
      }),
    ).toBe(false);
    expect(() =>
      assertChatRealtimePayloadAllowed({
        message: {
          id: 'message-1',
          [key]: value,
        },
      }),
    ).toThrow(/forbidden payload key/);
  });
});
