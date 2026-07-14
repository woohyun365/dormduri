import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../generated/prisma/sql.js', () => ({
  getCurrentTimestamp: vi.fn(() => ({})),
}));

import { EnforcementNoticePresenter } from '../presenters/enforcement-notice.presenter.js';
import type {
  EnforcementNoticeProjectionRecord,
  EnforcementNoticeRepository,
} from '../repositories/enforcement-notice.repository.js';
import { EnforcementNoticeListQuery } from './enforcement-notice-list.query.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';

const now = new Date('2026-07-03T00:00:00.000Z');

function record(
  input: Partial<EnforcementNoticeProjectionRecord> = {},
): EnforcementNoticeProjectionRecord {
  const base: EnforcementNoticeProjectionRecord = {
    id: 'participant-1',
    userId: 'user-1',
    seasonId: 'season-1',
    dormitoryId: 'dorm-1',
    hiddenByAdminAt: new Date('2026-07-01T00:00:00.000Z'),
    hiddenReasonCode: 'POLICY_VIOLATION',
    hiddenReasonDetail: 'raw internal note must not leak',
    deactivatedAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    season: {
      id: 'season-1',
      name: '2026년 2학기',
      academicYear: 2026,
      semester: 2,
      seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
    },
    dormitory: {
      id: 'dorm-1',
      nameKo: '다산관',
    },
  };
  return { ...base, ...input };
}

describe('EnforcementNoticeListQuery', () => {
  it('본인에게 적용된 제재 projection을 사용자-facing 내역으로 변환하고 내부 detail을 숨긴다', async () => {
    const findForUser = vi.fn().mockResolvedValue([record({ id: 'participant-2' }), record()]);
    const prisma = { getDatabaseNow: vi.fn().mockResolvedValue(now) } as unknown as PrismaService;
    const repository = { findForUser } as unknown as EnforcementNoticeRepository;
    const query = new EnforcementNoticeListQuery(
      prisma,
      repository,
      new EnforcementNoticePresenter(),
    );

    const response = await query.listOwn(
      { id: 'user-1', campus: 'CHUNCHEON', gender: 'M' },
      { cursor: null, limit: 1 },
    );

    expect(findForUser).toHaveBeenCalledWith({ userId: 'user-1', cursor: null, limit: 1 });
    expect(response).toMatchObject({
      items: [
        {
          id: 'season-participant:participant-2',
          actionType: 'CONTENT_VISIBILITY_RESTRICTION',
          reasonCategory: 'POLICY_VIOLATION',
          scopeLabel: '2026년 2학기 · 다산관 룸메 탐색/매칭',
        },
      ],
      pageInfo: { hasNextPage: true },
    });
    expect(typeof response.pageInfo.nextCursor).toBe('string');
    expect(JSON.stringify(response)).not.toContain('raw internal note');
    expect(JSON.stringify(response)).not.toContain('reporterUserId');
  });
});
