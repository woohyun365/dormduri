import { describe, expect, it } from 'vitest';
import type { MatchingRequestCardView } from '../matching-request-view';
import { orderReceivedMatchRequests } from '../matching-request-ordering';

function request(
  id: string,
  input: { readonly score: number | null; readonly expiresAt: string },
): MatchingRequestCardView {
  return {
    id,
    counterpartUserId: `user-${id}`,
    direction: 'RECEIVED',
    presentation: 'pending',
    nickname: id,
    facts: [],
    intro: '',
    note: null,
    score: input.score,
    scoreHiddenCopy: input.score === null ? '매칭 점수가 공개되지 않아요.' : null,
    detailEntryToken: null,
    canStartChat: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: input.expiresAt,
    statusLabel: '응답 대기',
    actions: {
      accept: { allowed: true, reason: null, reasonCopy: null, reasonDescriptionId: null },
      reject: { allowed: true, reason: null, reasonCopy: null, reasonDescriptionId: null },
      cancel: { allowed: false, reason: null, reasonCopy: null, reasonDescriptionId: null },
    },
  };
}

const requests = [
  request('canonical-first', { score: 80, expiresAt: '2026-08-05T00:00:00.000Z' }),
  request('highest-score', { score: 95, expiresAt: '2026-08-06T00:00:00.000Z' }),
  request('expires-first', { score: 75, expiresAt: '2026-08-04T00:00:00.000Z' }),
  request('score-hidden', { score: null, expiresAt: '2026-08-03T00:00:00.000Z' }),
] as const;

describe('orderReceivedMatchRequests', () => {
  it('응답 마감순은 expiresAt이 가까운 요청부터 표시한다', () => {
    expect(orderReceivedMatchRequests(requests, 'expires-soon').map(({ id }) => id)).toEqual([
      'score-hidden',
      'expires-first',
      'canonical-first',
      'highest-score',
    ]);
  });

  it('매칭도순은 공개 점수 내림차순이며 비공개 점수는 마지막에 둔다', () => {
    expect(orderReceivedMatchRequests(requests, 'match-score').map(({ id }) => id)).toEqual([
      'highest-score',
      'canonical-first',
      'expires-first',
      'score-hidden',
    ]);
  });
});
