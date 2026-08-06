import { describe, expect, it } from 'vitest';
import {
  enforcementNoticeListResponseSchema,
  listEnforcementNoticesQuerySchema,
} from '@repo/shared/social-safety/enforcement';

const serverTime = '2026-07-03T00:00:00.000Z';

describe('enforcement notice shared contract', () => {
  it('피신고인 본인용 제재/제한 내역 list query와 공개 응답 필드만 허용한다', () => {
    expect(listEnforcementNoticesQuerySchema.parse({ limit: '10' })).toMatchObject({ limit: 10 });

    expect(
      enforcementNoticeListResponseSchema.parse({
        items: [
          {
            id: 'season-participant:participant-1',
            actionType: 'MATCHING_RESTRICTION',
            reasonCategory: 'HATE_OR_DISCRIMINATION',
            status: 'ACTIVE',
            seasonLabel: '2026년 2학기',
            scopeLabel: '2026년 2학기 · 다산관 룸메 탐색/매칭',
            policyBasisSummary: '서비스 이용 기준에 따라 필요한 범위에서 적용된 제한이에요.',
            effectiveFrom: serverTime,
            effectiveUntil: '2026-08-31T00:00:00.000Z',
            createdAt: serverTime,
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    ).toMatchObject({ items: [{ actionType: 'MATCHING_RESTRICTION' }] });

    expect(() =>
      enforcementNoticeListResponseSchema.parse({
        items: [
          {
            id: 'season-participant:participant-1',
            actionType: 'MATCHING_RESTRICTION',
            reasonCategory: 'POLICY_VIOLATION',
            status: 'ACTIVE',
            seasonLabel: '2026년 2학기',
            scopeLabel: '2026년 2학기 룸메 탐색/매칭',
            policyBasisSummary: '서비스 이용 기준에 따라 필요한 범위에서 적용된 제한이에요.',
            effectiveFrom: serverTime,
            effectiveUntil: '2026-08-31T00:00:00.000Z',
            createdAt: serverTime,
            reporterUserId: 'reporter-user',
            rawEvidence: 'raw report detail',
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    ).toThrow();
  });
});
