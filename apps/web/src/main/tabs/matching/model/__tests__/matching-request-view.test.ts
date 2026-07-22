import type { MatchRequestWithActions } from '@repo/shared/match/contract';
import { describe, expect, it } from 'vitest';
import { toMatchingRequestSectionView } from '../matching-request-view';

function request(
  id: string,
  overrides: Partial<MatchRequestWithActions> = {},
): MatchRequestWithActions {
  return {
    id,
    seasonId: 'season-1',
    direction: 'SENT',
    counterpartUserId: `user-${id}`,
    counterpartParticipantId: `participant-${id}`,
    counterpartSummary: {
      id: `summary-${id}`,
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { type: 'GENERAL' },
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: true,
        unavailableReasons: [],
      },
      resultRead: { resultReadable: false, context: 'NONE' },
      profileSummary: {
        nickname: `사용자 ${id}`,
        intro: '서로 배려하는 생활을 원해요.',
        smokingBehavior: 'NO',
        sleepHabit: null,
        relationshipStyle: null,
      },
      detailEntryToken: `detail-${id}`,
      matchScore: 88,
      activeChatThread: {
        id: `thread-${id}`,
        threadKind: 'DIRECT',
        status: 'OPEN',
        lastMessageAt: '2026-08-01T04:00:00.000Z',
      },
    },
    status: 'PENDING',
    note: '  잘 부탁해요.  ',
    createdAt: '2026-08-01T03:00:00.000Z',
    expiresAt: '2026-08-05T03:00:00.000Z',
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
    actions: {
      accept: { allowed: false, reason: null },
      reject: { allowed: false, reason: null },
      cancel: { allowed: true, reason: null },
    },
    ...overrides,
  };
}

describe('matching request view model', () => {
  it.each([
    [0, { used: 0, remaining: 3 }],
    [1, { used: 1, remaining: 2 }],
    [3, { used: 3, remaining: 0 }],
  ] as const)('sent pending %i건을 표시 quota로만 계산한다', (count, expected) => {
    const sent = Array.from({ length: count }, (_, index) => request(`sent-${index}`));
    const view = toMatchingRequestSectionView({ sentRequests: sent, receivedRequests: [] });

    expect(view.quota).toEqual({ ...expected, limit: 3 });
    expect(view.sent.map((item) => item.id)).toEqual(sent.map((item) => item.id));
  });

  it('API의 canonical ordering을 보존하고 score/note/detail exposure를 정규화한다', () => {
    const visible = request('received-new', {
      direction: 'RECEIVED',
      actions: {
        accept: { allowed: true, reason: null },
        reject: { allowed: true, reason: null },
        cancel: { allowed: false, reason: null },
      },
    });
    const hidden = request('received-old', {
      direction: 'RECEIVED',
      note: '   ',
      counterpartSummary: {
        ...request('hidden').counterpartSummary,
        exposure: {
          listSummaryVisible: true,
          detailViewable: false,
          canViewFull: false,
          scoreVisible: false,
        },
        detailEntryToken: undefined,
        matchScore: undefined,
      },
    });

    const view = toMatchingRequestSectionView({
      sentRequests: [],
      receivedRequests: [visible, hidden],
    });

    expect(view.received.map((item) => item.id)).toEqual(['received-new', 'received-old']);
    expect(view.received[0]).toMatchObject({
      note: '잘 부탁해요.',
      score: 88,
      hasActiveChatThread: true,
      facts: [
        { label: '흡연 여부', value: '비흡연' },
        { label: '잠버릇', value: '비공개' },
        { label: '관계', value: '비공개' },
      ],
    });
    expect(view.received[1]).toMatchObject({ note: null, score: null, detailEntryToken: null });
    expect(view.received[1]?.scoreHiddenCopy).toContain('공개되지');
  });

  it.each([
    ['ACCEPTED', '수락됨'],
    ['REJECTED', '거절됨'],
    ['CANCELLED_BY_REQUESTER', '취소됨'],
    ['CANCELLED_BY_SYSTEM', '요청 종료'],
    ['EXPIRED', '기간 만료'],
  ] as const)('terminal %s는 제한된 public label만 제공한다', (status, label) => {
    const view = toMatchingRequestSectionView({
      sentRequests: [
        request('terminal', {
          status,
          terminalAt: '2026-08-02T00:00:00.000Z',
          terminalReason: status === 'ACCEPTED' ? 'ACCEPTED' : 'ADMIN_ACTION',
          actions: {
            accept: { allowed: false, reason: 'REQUEST_ALREADY_RESOLVED' },
            reject: { allowed: false, reason: 'REQUEST_ALREADY_RESOLVED' },
            cancel: { allowed: false, reason: 'REQUEST_ALREADY_RESOLVED' },
          },
        }),
      ],
      receivedRequests: [],
    });

    expect(view.sent[0]).toMatchObject({ presentation: 'terminal', statusLabel: label });
    expect(JSON.stringify(view.sent[0])).not.toContain('ADMIN_ACTION');
  });
});
