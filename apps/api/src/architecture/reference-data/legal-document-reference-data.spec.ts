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

function findRow(kind: LegalDocumentKindValue): LegalDocumentSeedRow {
  const row = legalDocumentRows.find((candidate) => candidate.kind === kind);
  if (row === undefined) {
    throw new Error(`Missing legal document seed row: ${kind}`);
  }
  return row;
}

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
  it('가입에 필요한 네 종류의 현재 게시 legal document seed를 제공한다', () => {
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
    expect(allText).not.toContain('active 사용자');
    expect(allText).not.toMatch(
      /user-facing|read model|payload|tombstone|cache|active 계정|ticket|공개 API/i,
    );
  });

  it('이용약관과 개인정보 처리방침 seed는 공개 전문용 조문형 heading을 포함한다', () => {
    const termsText = flattenText(findRow(LegalDocumentKind.TERMS_OF_SERVICE).sections).join('\n');
    const privacyText = flattenText(findRow(LegalDocumentKind.PRIVACY_POLICY).sections).join('\n');

    expect(termsText).toContain('제1조(목적)');
    expect(termsText).toContain('제2조(정의)');
    expect(termsText).toContain('제12조(문의 및 분쟁 처리)');
    expect(privacyText).toContain('제1조(개인정보의 처리 목적)');
    expect(privacyText).toContain('제2조(처리하는 개인정보 항목 및 보유기간)');
    expect(privacyText).toContain('제11조(개인정보 처리방침의 변경)');
  });
});
