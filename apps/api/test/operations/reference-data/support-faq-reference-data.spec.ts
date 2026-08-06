import { describe, expect, it } from 'vitest';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { SUPPORT_FAQ_REFERENCE_ROWS } from '../../../prisma/seed-data/reference/support-faq-seed-data.js';
import { supportTicketCategorySchema } from '@repo/shared/support';

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
  it('기본 공개 FAQ는 모두 published SUPPORT_CENTER placement를 가진다', () => {
    expect(supportFaqRows).toHaveLength(6);

    for (const row of supportFaqRows) {
      expect(row.id).toMatch(/^support-/);
      expect(supportTicketCategorySchema.safeParse(row.category).success).toBe(true);
      expect(row.published).toBe(true);
      expect(row.question.trim().length).toBeGreaterThan(0);
      expect(row.answer.trim().length).toBeGreaterThan(0);
      expect(row.placements).toEqual([
        {
          surface: 'SUPPORT_CENTER',
          sortOrder: row.sortOrder,
        },
      ]);
      expect(row.placements[0]!.surface).toBe('SUPPORT_CENTER');
    }
  });

  it('기본 FAQ는 Support Center에서 필요한 제품 경계를 설명한다', () => {
    expect(supportFaqRows.map((row) => row.id)).toEqual([
      'support-service-boundary-independent-service',
      'support-room-selection-not-guaranteed',
      'support-lifestyle-survey-disclaimer',
      'support-season-capability-boundary',
      'support-profile-privacy-warning',
      'support-channel-guidance',
    ]);
  });
});
