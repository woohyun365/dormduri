import { describe, expect, it } from 'vitest';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { SUPPORT_FAQ_REFERENCE_ROWS } from '../../../prisma/seed-data/reference/support-faq-seed-data.js';
import { supportTicketCategorySchema, supportFaqSurfaceSchema } from '@repo/shared/support';

type SupportFaqSeedRow = {
  id: string;
  category: string;
  question: string;
  answer: string;
  published: boolean;
  sortOrder: number;
  placements: Array<{ surface: string; sortOrder: number }>;
};

const supportFaqRows = SUPPORT_FAQ_REFERENCE_ROWS as SupportFaqSeedRow[];

describe('support FAQ reference seed data', () => {
  it('기본 공개 FAQ는 모두 published LANDING placement를 가진다', () => {
    expect(supportFaqRows).toHaveLength(6);

    for (const row of supportFaqRows) {
      expect(row.id).toMatch(/^landing-/);
      expect(supportTicketCategorySchema.safeParse(row.category).success).toBe(true);
      expect(row.published).toBe(true);
      expect(row.question.trim().length).toBeGreaterThan(0);
      expect(row.answer.trim().length).toBeGreaterThan(0);
      expect(row.placements).toEqual([
        {
          surface: 'LANDING',
          sortOrder: row.sortOrder,
        },
      ]);
      expect(supportFaqSurfaceSchema.safeParse(row.placements[0]!.surface).success).toBe(true);
    }
  });

  it('기본 FAQ는 Landing fallback과 같은 제품 경계를 설명한다', () => {
    expect(supportFaqRows.map((row) => row.id)).toEqual([
      'landing-service-boundary-independent-service',
      'landing-room-selection-not-guaranteed',
      'landing-lifestyle-survey-disclaimer',
      'landing-season-capability-boundary',
      'landing-profile-privacy-warning',
      'landing-faq-not-support-ticket',
    ]);
  });
});
