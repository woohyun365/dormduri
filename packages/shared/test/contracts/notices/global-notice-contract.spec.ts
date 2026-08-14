import { describe, expect, it } from 'vitest';
import {
  globalNoticeDetailResponseSchema,
  globalNoticeListResponseSchema,
  globalNoticeSchema,
  listGlobalNoticesQuerySchema,
  noticeSeveritySchema,
} from '@repo/shared/notices';

const iso = '2026-07-03T00:00:00.000Z';

const preview = {
  id: 'notice-1',
  title: '운영 안내',
  summary: '서비스 점검 안내입니다.',
  severity: 'INFO',
  relatedSeasonId: null,
  publishedAt: iso,
  expiresAt: null,
  createdAt: iso,
  updatedAt: iso,
};

describe('global notice shared/API contract', () => {
  it('severity와 list query를 allowlist로 고정한다', () => {
    expect(noticeSeveritySchema.options).toEqual(['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']);
    expect(listGlobalNoticesQuerySchema.parse({ limit: '3', severity: 'WARNING' })).toEqual({
      limit: 3,
      severity: 'WARNING',
    });
    expect(listGlobalNoticesQuerySchema.parse({})).toEqual({ limit: 3 });
    expect(listGlobalNoticesQuerySchema.safeParse({ limit: 100 }).success).toBe(false);
    expect(listGlobalNoticesQuerySchema.safeParse({ unsupported: true }).success).toBe(false);
    expect(listGlobalNoticesQuerySchema.safeParse({ severity: 'PROMOTION' }).success).toBe(false);
  });

  it('list response는 preview 필드만 허용하고 body를 detail contract로 분리한다', () => {
    expect(
      globalNoticeListResponseSchema.parse({
        items: [preview],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    ).toEqual({ items: [preview], pageInfo: { hasNextPage: false, nextCursor: null } });

    expect(
      globalNoticeListResponseSchema.safeParse({
        items: [{ ...preview, body: '목록에 노출하면 안 되는 공지 본문' }],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }).success,
    ).toBe(false);

    expect(globalNoticeSchema.parse({ ...preview, body: '상세 본문' })).toEqual({
      ...preview,
      body: '상세 본문',
    });
    expect(
      globalNoticeDetailResponseSchema.parse({ notice: { ...preview, body: '상세 본문' } }),
    ).toEqual({
      notice: { ...preview, body: '상세 본문' },
    });
  });
});
