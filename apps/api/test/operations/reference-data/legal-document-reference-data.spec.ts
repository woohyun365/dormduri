import { describe, expect, it } from 'vitest';
import {
  LegalDocumentKind,
  legalDocumentResponseSchema,
  type LegalDocumentKind as LegalDocumentKindValue,
} from '@repo/shared/legal';
import * as sharedLegal from '@repo/shared/legal';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import * as legalSeedData from '../../../prisma/seed-data/reference/legal-document-seed-data.js';

type LegalDocumentSeedRow = {
  id: string;
  kind: LegalDocumentKindValue;
  version: string;
  title: string;
  summaryItems: string[];
  sections: unknown[];
  changeSummary?: string;
};

const seedData = legalSeedData as Record<string, unknown>;
const legalDocumentRows = seedData.LEGAL_DOCUMENT_REFERENCE_ROWS as LegalDocumentSeedRow[];

type LegalVersionSeedRow = {
  id: string;
  kind: LegalDocumentKindValue;
  version: string;
  noticeClass: string;
  consentRequired: boolean;
  effectiveDate: string;
  appliesUntil: string | null;
  title: string;
  summaryItems: string[];
  sections: unknown[];
  changeSummary: string;
};

function requireSeedExport<T>(name: string): T {
  expect(seedData[name], `legal seed export ${name}`).toBeDefined();
  return seedData[name] as T;
}

function requireSharedSchema(name: string) {
  const schema = (sharedLegal as unknown as Record<string, { safeParse?: unknown }>)[name];
  expect(typeof schema?.safeParse, name).toBe('function');
  return schema as unknown as { safeParse: (value: unknown) => { success: boolean } };
}

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

    // Effective dates come from the version seed list; the date fields of the four arrays are not read.
    const versionRows = requireSeedExport<LegalVersionSeedRow[]>(
      'LEGAL_DOCUMENT_VERSION_SEED_ROWS',
    );
    for (const row of legalDocumentRows) {
      const version = versionRows.find((candidate) => candidate.id === row.id);
      expect(version, row.id).toBeDefined();
      expect(row.summaryItems.length).toBeGreaterThan(0);
      expect(row.sections.length).toBeGreaterThan(0);
      expect(
        legalDocumentResponseSchema.safeParse({
          id: row.id,
          kind: row.kind,
          version: row.version,
          title: row.title,
          effectiveAt: `${version?.effectiveDate}T00:00:00.000Z`,
          lastModifiedAt: `${version?.effectiveDate}T00:00:00.000Z`,
          summaryItems: row.summaryItems,
          sections: row.sections,
          changeSummary: row.changeSummary,
        }).success,
      ).toBe(true);
    }
  });

  it('판 seed 목록은 처리방침 이전 판 기록과 첫 게시, 나머지 셋의 첫 게시를 시행일과 함께 낸다', () => {
    const versionRows = requireSeedExport<LegalVersionSeedRow[]>(
      'LEGAL_DOCUMENT_VERSION_SEED_ROWS',
    );

    expect(
      versionRows.map((row) => [
        row.id,
        row.kind,
        row.noticeClass,
        row.effectiveDate,
        row.appliesUntil,
      ]),
    ).toEqual([
      ['terms-of-service-2026-06-22', 'TERMS_OF_SERVICE', 'INITIAL', '2026-06-22', null],
      ['privacy-policy-2026-06-22', 'PRIVACY_POLICY', 'INITIAL', '2026-11-20', null],
      [
        'personal-data-collection-use-consent-2026-06-22',
        'PERSONAL_DATA_COLLECTION_USE_CONSENT',
        'INITIAL',
        '2026-06-22',
        null,
      ],
      [
        'age-14-or-above-notice-2026-06-22',
        'AGE_14_OR_ABOVE_NOTICE',
        'INITIAL',
        '2026-06-22',
        null,
      ],
      // The historical record follows the version that took its date, so a re-run never collides.
      [
        'privacy-policy-historical-2026-06-22',
        'PRIVACY_POLICY',
        'HISTORICAL',
        '2026-06-22',
        '2026-11-19',
      ],
    ]);
    expect(new Set(versionRows.map((row) => row.version)).size).toBe(versionRows.length);
    for (const row of versionRows) {
      expect(row.consentRequired, row.id).toBe(false);
      expect(row.changeSummary.trim().length, row.id).toBeGreaterThan(0);
      const reference = legalDocumentRows.find((candidate) => candidate.id === row.id);
      if (reference) {
        // Published versions copy the body of the four document arrays.
        expect([row.title, row.summaryItems, row.sections, row.changeSummary]).toEqual([
          reference.title,
          reference.summaryItems,
          reference.sections,
          reference.changeSummary,
        ]);
      }
    }
  });

  it('처리방침 이전 판 기록은 2026-11-20 전에 공개된 본문이다', () => {
    const versionRows = requireSeedExport<LegalVersionSeedRow[]>(
      'LEGAL_DOCUMENT_VERSION_SEED_ROWS',
    );
    const historical = versionRows.find((row) => row.noticeClass === 'HISTORICAL');
    const historicalText = flattenText(historical?.sections ?? []).join('\n');
    const currentText = flattenText(findRow(LegalDocumentKind.PRIVACY_POLICY).sections).join('\n');

    expect(historicalText).toContain('안전성 확보조치 기준에 따라 1년 보관');
    expect(historicalText).not.toContain('운영 관측 저장소');
    expect(currentText).toContain('안전성 확보조치 기준에 따라 2년 보관');
    expect(historical?.changeSummary).toBe(
      '조문형 처리방침 구조에 맞춰 처리 목적, 항목·보유기간, 제3자 제공, 위탁, 권리 행사, 파기·안전조치 기준을 정리하고, 처리업무 수탁자와 국외 이전, 방문 통계, 개인정보 보호책임자와 문의 이메일을 적었습니다.',
    );
  });

  it('처리방침 첫 개정 초안은 가져오기 schema를 통과하는 일반 고지 초안이고 판 행이 아니다', () => {
    const draft = requireSeedExport<Record<string, unknown>>(
      'LEGAL_PRIVACY_POLICY_FIRST_REVISION_DRAFT',
    );
    const importSchema = requireSharedSchema('legalDocumentDraftImportSchema');
    const versionRows = requireSeedExport<LegalVersionSeedRow[]>(
      'LEGAL_DOCUMENT_VERSION_SEED_ROWS',
    );

    expect(importSchema.safeParse(draft).success).toBe(true);
    expect(draft).toMatchObject({
      kind: LegalDocumentKind.PRIVACY_POLICY,
      noticeClass: 'GENERAL',
      consentRequired: false,
    });
    expect('id' in draft).toBe(false);
    expect(versionRows.some((row) => row.noticeClass === 'GENERAL')).toBe(false);
    const draftText = flattenText(draft.sections).join('\n');
    // Access record line split: database and session start records 2 years, admin console audit 3 years.
    expect(draftText).toMatch(/2년/u);
    expect(draftText).toMatch(/3년/u);
    expect(draftText).not.toContain('정해지면 안내');
    expect(draftText).toContain('제11조(개인정보 처리방침의 변경)');
  });

  it('seed copy는 raw HTML/script와 plan-dependent 표현을 포함하지 않는다', () => {
    const allText = [
      ...legalDocumentRows,
      ...(seedData.LEGAL_DOCUMENT_VERSION_SEED_ROWS as unknown[]),
      seedData.LEGAL_PRIVACY_POLICY_FIRST_REVISION_DRAFT,
    ]
      .flatMap(flattenText)
      .join('\n');

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
    expect(privacyText).toContain('제4조(개인정보 처리업무의 위탁 및 국외 이전)');
    expect(privacyText).toContain('제11조(개인정보 처리방침의 변경)');
  });

  it('개인정보 처리방침 seed는 국외 이전 표에 법정 공개 다섯 항목 열을 둔다', () => {
    const privacySections = findRow(LegalDocumentKind.PRIVACY_POLICY).sections as Array<{
      type: string;
      caption?: string;
      headers?: string[];
      rows?: string[][];
    }>;
    const transferTable = privacySections.find(
      (section) => section.type === 'table' && section.caption === '개인정보의 국외 이전',
    );

    expect(transferTable?.headers).toEqual([
      '이전받는 자와 연락처',
      '이전 국가·시기·방법',
      '이전 항목',
      '이용 목적과 보유·이용 기간',
      '거부 방법·절차·효과',
    ]);
    expect(transferTable?.rows?.length).toBeGreaterThan(0);
  });
});
