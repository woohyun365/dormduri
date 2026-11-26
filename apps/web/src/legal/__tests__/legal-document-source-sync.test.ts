import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LegalDocumentKind,
  type LegalDocumentResponse,
  type LegalDocumentSection,
} from '@repo/shared/legal';

import {
  seedActiveLegalDocument,
  seedLegalDocumentPage,
  seedLegalFirstRevisionDraft,
} from '../testing/legal-seed-documents';

// The public legal text has one source: the published versions in the database, which the development and test seed
// writes from apps/api/prisma/seed-data/reference. Production versions are approved in the backoffice, whose
// approval screen shows the article comparison. These checks keep the facts the seed text states: the version in
// effect and the first revision drafts the backoffice imports.
type SeedText = Pick<LegalDocumentResponse, 'sections' | 'changeSummary'>;

function flattenSection(section: LegalDocumentSection): string[] {
  switch (section.type) {
    case 'heading':
      return [section.text];
    case 'paragraph':
    case 'callout':
      return [section.text];
    case 'list':
      return section.items;
    case 'table':
      return [section.caption ?? '', ...section.headers, ...section.rows.flat()];
  }
}

// Blocks after the heading `title` up to the next heading.
function article(document: SeedText, title: string): LegalDocumentSection[] {
  const start = document.sections.findIndex(
    (section) => section.type === 'heading' && section.text === title,
  );
  expect(start, title).toBeGreaterThanOrEqual(0);
  const rest = document.sections.slice(start + 1);
  const end = rest.findIndex((section) => section.type === 'heading');
  return end === -1 ? rest : rest.slice(0, end);
}

function emailAddresses(sections: LegalDocumentSection[]): string[] {
  const text = sections.flatMap(flattenSection).join('\n');
  return [...new Set(text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu) ?? [])];
}

// The Landing feature is imported only through its public entry, so its footer copy is read as source
// text (the same way legal-document-boundary.spec.ts reads Landing files).
function landingFooterInquiryAddress(): string {
  const source = readFileSync(
    resolve(process.cwd(), 'src/screens/landing/model/landingCopy.ts'),
    'utf8',
  );
  const address = /inquiryAddress: '([^']+)'/u.exec(source)?.[1];
  if (address === undefined) throw new Error('Landing footer inquiryAddress not found');
  return address;
}

const termsInEffect = seedActiveLegalDocument(LegalDocumentKind.TERMS_OF_SERVICE);
const privacyInEffect = seedActiveLegalDocument(LegalDocumentKind.PRIVACY_POLICY);
const privacyRevision = seedLegalFirstRevisionDraft('PRIVACY_POLICY');
const termsRevision = seedLegalFirstRevisionDraft('TERMS_OF_SERVICE');
const privacyTexts: Array<[string, SeedText]> = [
  ['privacy policy in effect', privacyInEffect],
  ['privacy policy first revision draft', privacyRevision],
];

describe('legal seed versions', () => {
  it('reads every seed version through the shared public contract', () => {
    for (const kind of Object.values(LegalDocumentKind)) {
      expect(seedLegalDocumentPage(kind)?.viewing.status, kind).toBe('current');
    }
    const privacy = seedLegalDocumentPage(LegalDocumentKind.PRIVACY_POLICY);
    expect(privacy?.versions.map(({ versionKey, status }) => [versionKey, status])).toEqual([
      ['2026-11-20', 'current'],
      ['2026-06-22', 'previous'],
    ]);
    expect(
      seedLegalDocumentPage(LegalDocumentKind.PRIVACY_POLICY, '2026-06-22')?.viewing.appliesUntil,
    ).toBe('2026-11-19');
  });
});

describe('public legal contact and overseas transfer facts', () => {
  it('uses the Landing footer inquiry address as the only contact in the inquiry articles', () => {
    const inquiryAddress = landingFooterInquiryAddress();

    for (const [label, privacy] of privacyTexts) {
      expect(emailAddresses(article(privacy, '제9조(개인정보 보호책임자 및 문의)')), label).toEqual(
        [inquiryAddress],
      );
    }
    for (const [label, terms] of [
      ['terms of service in effect', termsInEffect],
      ['terms of service first revision draft', termsRevision],
    ] as const) {
      expect(emailAddresses(article(terms, '제12조(문의 및 분쟁 처리)')), label).toEqual([
        inquiryAddress,
      ]);
    }
  });

  it('discloses the five overseas transfer items for every recipient in article 4', () => {
    for (const [label, privacy] of privacyTexts) {
      const transferTable = article(privacy, '제4조(개인정보 처리업무의 위탁 및 국외 이전)').find(
        (section) => section.type === 'table' && section.caption === '개인정보의 국외 이전',
      );

      expect(transferTable, label).toMatchObject({
        headers: [
          '이전받는 자와 연락처',
          '이전 국가·시기·방법',
          '이전 항목',
          '이용 목적과 보유·이용 기간',
          '거부 방법·절차·효과',
        ],
      });
      if (transferTable?.type !== 'table') return;
      expect(
        transferTable.rows.map((row) => row[0]?.split('(')[0]),
        label,
      ).toEqual(['Cloudflare, Inc.', 'Google LLC']);
      for (const row of transferTable.rows) {
        expect(row, label).toHaveLength(transferTable.headers.length);
        expect(
          row.every((cell) => cell.trim().length > 0),
          label,
        ).toBe(true);
      }
    }
  });
});

describe('public privacy policy log retention and change notice', () => {
  function retentionBasis(privacy: SeedText, label: string): string {
    const retentionTable = article(privacy, '제2조(처리하는 개인정보 항목 및 보유기간)').find(
      (section) => section.type === 'table' && section.caption === '주요 보유기간과 파기 기준',
    );
    if (retentionTable?.type !== 'table') throw new Error('retention table not found');
    const row = retentionTable.rows.find((candidate) => candidate[0] === label);
    if (row?.[1] === undefined) throw new Error(`retention row not found: ${label}`);
    return row[1];
  }

  it('keeps the personal data processing system access record for two years', () => {
    for (const [label, privacy] of privacyTexts) {
      expect(retentionBasis(privacy, '개인정보처리시스템 접속 기록'), label).toContain('2년 보관');
    }
  });

  // Until the ingress writes masked addresses, and again during a rollback to the old log format, the
  // original IP is in the host json-file. Only the observability store sentence may claim masking.
  it('claims IP masking and the 30-day limit only for the observability store records', () => {
    for (const [label, privacy] of privacyTexts) {
      const [serverSentence, ...storeSentences] = retentionBasis(
        privacy,
        '웹 서버 접속 기록',
      ).split('. ');
      const storeText = storeSentences.join('. ');

      expect(serverSentence, label).toContain('서비스 서버에만');
      expect(serverSentence, label).toContain('오래된 기록부터 자동으로 삭제');
      expect(serverSentence, label).not.toMatch(/가린|가리|가림|마스킹|비식별|익명|일부|30일/u);
      expect(storeText, label).toContain('서비스 서버 안의 운영 관측 저장소');
      expect(storeText, label).toContain('가린');
      expect(storeText, label).toContain('30일');
    }
  });

  // legal-basis.md LB-R10: a changed version states when it applies in its change summary.
  it('states the effective date in the change summary of the privacy policy in effect', () => {
    const page = seedLegalDocumentPage(LegalDocumentKind.PRIVACY_POLICY);
    const [year, month, day] = (page?.viewing.versionKey ?? '').split('-').map(Number);

    expect(page?.viewing.changeSummary).toContain(`${year}년 ${month}월 ${day}일부터 적용`);
  });
});
