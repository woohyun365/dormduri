import { describe, expect, it } from 'vitest';
import {
  LegalDocumentKind,
  legalDocumentResponseSchema,
  type LegalDocumentKind as LegalDocumentKindValue,
} from '@repo/shared/legal';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { LEGAL_DOCUMENT_REFERENCE_ROWS } from '../../../prisma/seed-data/reference/legal-document-seed-data.js';

type LegalDocumentSeedRow = {
  id: string;
  kind: LegalDocumentKindValue;
  version: string;
  title: string;
  effectiveAt: string;
  publishedAt: string | null;
  retiredAt: string | null;
  summaryItems: string[];
  sections: unknown[];
  changeSummary?: string;
};

const legalDocumentRows = LEGAL_DOCUMENT_REFERENCE_ROWS as LegalDocumentSeedRow[];

function flattenText(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenText);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(flattenText);
  }
  return [];
}

describe('legal document reference seed data', () => {
  it('가입에 필요한 네 종류의 active legal document seed를 제공한다', () => {
    expect(legalDocumentRows.map((row) => row.kind).sort()).toEqual(
      [
        LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
        LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        LegalDocumentKind.PRIVACY_POLICY,
        LegalDocumentKind.TERMS_OF_SERVICE,
      ].sort(),
    );

    for (const row of legalDocumentRows) {
      expect(row.publishedAt).toBeTruthy();
      expect(row.retiredAt).toBeNull();
      expect(row.summaryItems.length).toBeGreaterThan(0);
      expect(row.sections.length).toBeGreaterThan(0);
      expect(
        legalDocumentResponseSchema.safeParse({
          id: row.id,
          kind: row.kind,
          version: row.version,
          title: row.title,
          effectiveAt: row.effectiveAt,
          lastModifiedAt: row.effectiveAt,
          summaryItems: row.summaryItems,
          sections: row.sections,
          changeSummary: row.changeSummary,
        }).success,
      ).toBe(true);
    }
  });

  it('seed copy는 raw HTML/script와 plan-dependent 표현을 포함하지 않는다', () => {
    const allText = legalDocumentRows.flatMap(flattenText).join('\n');

    expect(allText).not.toMatch(/<\/?[a-z][\s\S]*>/i);
    expect(allText).not.toMatch(/<script|javascript:/i);
    expect(allText).not.toMatch(/Phase|phase|plan|issue|#\d+/i);
    expect(allText).not.toContain('개인정보 처리방침에 동의합니다');
  });
});
