import { describe, expect, it } from 'vitest';
import type { UserNotification } from '@repo/shared/notifications';
import { toNotificationDisplay } from '../model/notificationCopy.mapper';

const occurredAt = '2026-07-03T00:00:00.000Z';

function createNotification(overrides: Partial<UserNotification>): UserNotification {
  return {
    id: 'notification-1',
    recipientUserId: 'user-1',
    actorUserId: 'actor-1',
    kind: 'SEASON_SYSTEM_NOTICE',
    sourceType: 'SEASON',
    sourceId: 'season-2026-02',
    payload: {
      kind: 'SEASON_SYSTEM_NOTICE',
      campaignId: 'campaign-1',
      seasonId: 'season-2026-02',
      noticeCode: 'SEASON_MATCHING_OPEN',
      occurredAt,
    },
    readAt: null,
    createdAt: occurredAt,
    ...overrides,
  } as UserNotification;
}

describe('toNotificationDisplay', () => {
  it.each([
    [
      'ENFORCEMENT_NOTICE',
      '서비스 이용 제한이 적용됐어요',
      '위반 사유: 혐오/차별 표현. 이의가 있으면 고객센터에서 재검토를 요청할 수 있어요.',
      '고객센터에서 확인',
      createNotification({
        kind: 'ENFORCEMENT_NOTICE',
        sourceType: 'ENFORCEMENT_NOTICE',
        sourceId: 'season-participant:participant-1',
        payload: {
          kind: 'ENFORCEMENT_NOTICE',
          enforcementNoticeId: 'season-participant:participant-1',
          actionType: 'MATCHING_RESTRICTION',
          reasonCategory: 'HATE_OR_DISCRIMINATION',
          occurredAt,
        },
      }),
    ],
    [
      'MATCH_REQUEST_RECEIVED',
      '새 매칭 요청이 도착했어요',
      '받은 요청에서 상대의 정보를 확인하고 수락 여부를 결정할 수 있어요.',
      '매칭 탭에서 확인',
      createNotification({
        kind: 'MATCH_REQUEST_RECEIVED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'match-request-1',
        payload: {
          kind: 'MATCH_REQUEST_RECEIVED',
          matchRequestId: 'match-request-1',
          seasonId: 'season-2026-02',
          occurredAt,
        },
      }),
    ],
    [
      'MATCH_REQUEST_ACCEPTED',
      '보낸 매칭 요청이 수락됐어요',
      '상대가 요청을 수락해 매칭이 확정됐어요. 채팅에서 필요한 내용을 함께 확인해보세요.',
      '매칭 탭에서 확인',
      createNotification({
        kind: 'MATCH_REQUEST_ACCEPTED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'match-request-2',
        payload: {
          kind: 'MATCH_REQUEST_ACCEPTED',
          matchRequestId: 'match-request-2',
          activeMatchId: 'active-match-1',
          seasonId: 'season-2026-02',
          occurredAt,
        },
      }),
    ],
    [
      'MATCH_REQUEST_REJECTED',
      '보낸 매칭 요청이 거절됐어요',
      '이번 요청은 거절됐어요. 다른 룸메 후보를 계속 찾아볼 수 있어요.',
      '매칭 탭에서 확인',
      createNotification({
        kind: 'MATCH_REQUEST_REJECTED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'match-request-3',
        payload: {
          kind: 'MATCH_REQUEST_REJECTED',
          matchRequestId: 'match-request-3',
          seasonId: 'season-2026-02',
          occurredAt,
        },
      }),
    ],
    [
      'ACTIVE_MATCH_CREATED',
      '룸메 매칭이 확정됐어요',
      '매칭 상대와 호실 선택 전까지 필요한 내용을 함께 확인해보세요.',
      '매칭 결과 확인',
      createNotification({
        kind: 'ACTIVE_MATCH_CREATED',
        sourceType: 'ACTIVE_MATCH',
        sourceId: 'active-match-1',
        payload: {
          kind: 'ACTIVE_MATCH_CREATED',
          activeMatchId: 'active-match-1',
          seasonId: 'season-2026-02',
          occurredAt,
        },
      }),
    ],
  ])('%s 알림 copy를 사용자 친화적으로 만든다', (_kind, title, body, helper, notification) => {
    expect(toNotificationDisplay(notification)).toMatchObject({ title, body, helper });
  });
});
