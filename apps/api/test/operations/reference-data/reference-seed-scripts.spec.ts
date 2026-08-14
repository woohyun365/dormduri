import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error -- production seed modules are plain JS and imported for architecture coverage
import { seedCollegeReferenceData } from '../../../prisma/seeds/reference/colleges/seed-college-reference-data.js';
// @ts-expect-error -- production seed modules are plain JS and imported for architecture coverage
import { seedDormitoryReferenceData } from '../../../prisma/seeds/reference/dormitories/seed-dormitory-reference-data.js';
// @ts-expect-error -- production seed modules are plain JS and imported for architecture coverage
import { seedModerationReferenceData } from '../../../prisma/seeds/reference/moderation/seed-moderation-reference-data.js';

function createQueryClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

describe('reference seed scripts', () => {
  it('dormitory seed는 parameterized upsert 후 legacy row를 비활성화한다', async () => {
    const client = createQueryClient();

    const summary = await seedDormitoryReferenceData(client);

    expect(summary).toMatchObject({
      campuses: 3,
      dormitories: 14,
      matchingDormitories: 12,
    });
    expect(
      client.query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' &&
          sql.includes('ON CONFLICT (id)') &&
          Array.isArray(values) &&
          values.includes('samcheok-haesol'),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' && sql.includes('"isActive" = FALSE') && Array.isArray(values),
      ),
    ).toBe(true);
  });

  it('college seed는 shared catalog를 upsert하고 제거된 code를 비활성화한다', async () => {
    const client = createQueryClient();

    const summary = await seedCollegeReferenceData(client);

    expect(summary.campuses).toBe(3);
    expect(summary.colleges).toBeGreaterThan(0);
    expect(
      client.query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' &&
          sql.includes('UPDATE "CollegeMaster" AS legacy') &&
          sql.includes('NOT EXISTS') &&
          Array.isArray(values) &&
          values.includes('CHUNCHEON_IT'),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' &&
          sql.includes('ON CONFLICT (code)') &&
          Array.isArray(values) &&
          values.includes('CHUNCHEON_IT'),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' && sql.includes('"isActive" = FALSE') && Array.isArray(values),
      ),
    ).toBe(true);
  });

  it('moderation seed는 referenceKey로 동기화하고 operations row는 수정하지 않는다', async () => {
    const client = createQueryClient();

    const summary = await seedModerationReferenceData(client);

    expect(summary.moderationTerms).toBeGreaterThan(40);
    expect(
      client.query.mock.calls.some(
        ([sql]) =>
          typeof sql === 'string' &&
          sql.includes(`source = 'REFERENCE'::"ModerationTermSource" OR "referenceKey" IS NULL`) &&
          sql.includes('"normalizedTerm" = $3'),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' &&
          sql.includes('ON CONFLICT ("referenceKey")') &&
          sql.includes('\'REFERENCE\'::"ModerationTermSource"') &&
          Array.isArray(values) &&
          values.includes('sex'),
      ),
    ).toBe(true);

    const staleDeactivateCall = client.query.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('source = \'REFERENCE\'::"ModerationTermSource"') &&
        sql.includes('"isActive" = FALSE'),
    );
    expect(staleDeactivateCall).toBeDefined();
    expect(staleDeactivateCall?.[0]).not.toContain('OPERATIONS');
  });
});
