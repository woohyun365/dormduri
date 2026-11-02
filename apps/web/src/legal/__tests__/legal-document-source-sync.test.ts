import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LegalDocumentKind, type LegalDocumentResponse } from '@repo/shared/legal';

import { LEGAL_FALLBACK_DOCUMENTS } from '../content/legal-fallback-documents';

type LegalSection = LegalDocumentResponse['sections'][number];

type SeedSection =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { type: 'callout'; tone: string; text: string };

interface SeedLegalDocument {
  id: string;
  kind: string;
  version: string;
  title: string;
  effectiveAt: string;
  summaryItems: string[];
  sections: SeedSection[];
  changeSummary: string;
}

// The API seed is the source of the public legal copy (apps/api/src/legal/README.md) and the Web
// fallback is its synced copy. The seed `list` block has no `ordered` field, so blocks are compared
// as kind plus flattened text rather than as whole objects.
const seedModuleUrl = pathToFileURL(
  resolve(process.cwd(), '../api/prisma/seed-data/reference/legal-document-seed-data.js'),
).href;

async function loadSeedDocuments(): Promise<SeedLegalDocument[]> {
  const seedModule = (await import(/* @vite-ignore */ seedModuleUrl)) as {
    LEGAL_DOCUMENT_REFERENCE_ROWS: SeedLegalDocument[];
  };
  return seedModule.LEGAL_DOCUMENT_REFERENCE_ROWS;
}

function flattenSection(section: LegalSection | SeedSection): string[] {
  switch (section.type) {
    case 'heading':
      return [section.type, String(section.level), section.text];
    case 'paragraph':
      return [section.type, section.text];
    case 'list':
      return [section.type, ...section.items];
    case 'table':
      return [section.type, section.caption ?? '', ...section.headers, ...section.rows.flat()];
    case 'callout':
      return [section.type, section.tone, section.text];
  }
}

function comparable(document: LegalDocumentResponse | SeedLegalDocument) {
  return {
    id: document.id,
    kind: document.kind,
    version: document.version,
    title: document.title,
    effectiveAt: document.effectiveAt,
    summaryItems: document.summaryItems,
    sections: document.sections.map(flattenSection),
    changeSummary: document.changeSummary,
  };
}

describe('Web legal fallback and API legal seed', () => {
  it('keeps the same four documents with the same ids, versions, effective dates and body text', async () => {
    const seedDocuments = await loadSeedDocuments();
    const fallbackDocuments = Object.values(LEGAL_FALLBACK_DOCUMENTS);

    expect(seedDocuments.map((document) => document.kind).sort()).toEqual(
      fallbackDocuments.map((document) => document.kind).sort(),
    );

    for (const fallbackDocument of fallbackDocuments) {
      const seedDocument = seedDocuments.find(
        (document) => document.kind === fallbackDocument.kind,
      );

      expect(seedDocument, fallbackDocument.kind).toBeDefined();
      expect(comparable(fallbackDocument)).toEqual(comparable(seedDocument!));
    }
  });
});

// Blocks after the heading `title` up to the next heading.
function article(document: LegalDocumentResponse, title: string): LegalSection[] {
  const start = document.sections.findIndex(
    (section) => section.type === 'heading' && section.text === title,
  );
  expect(start, title).toBeGreaterThanOrEqual(0);
  const rest = document.sections.slice(start + 1);
  const end = rest.findIndex((section) => section.type === 'heading');
  return end === -1 ? rest : rest.slice(0, end);
}

function emailAddresses(sections: LegalSection[]): string[] {
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

describe('public legal contact and overseas transfer facts', () => {
  const terms = LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.TERMS_OF_SERVICE];
  const privacy = LEGAL_FALLBACK_DOCUMENTS[LegalDocumentKind.PRIVACY_POLICY];

  it('uses the Landing footer inquiry address as the only contact in the inquiry articles', () => {
    const inquiryAddress = landingFooterInquiryAddress();

    expect(emailAddresses(article(privacy, '제9조(개인정보 보호책임자 및 문의)'))).toEqual([
      inquiryAddress,
    ]);
    expect(emailAddresses(article(terms, '제12조(문의 및 분쟁 처리)'))).toEqual([inquiryAddress]);
  });

  it('discloses the five overseas transfer items for every recipient in article 4', () => {
    const transferTable = article(privacy, '제4조(개인정보 처리업무의 위탁 및 국외 이전)').find(
      (section) => section.type === 'table' && section.caption === '개인정보의 국외 이전',
    );

    expect(transferTable).toMatchObject({
      headers: [
        '이전받는 자와 연락처',
        '이전 국가·시기·방법',
        '이전 항목',
        '이용 목적과 보유·이용 기간',
        '거부 방법·절차·효과',
      ],
    });
    if (transferTable?.type !== 'table') return;
    expect(transferTable.rows.map((row) => row[0]?.split('(')[0])).toEqual([
      'Cloudflare, Inc.',
      'Google LLC',
    ]);
    for (const row of transferTable.rows) {
      expect(row).toHaveLength(transferTable.headers.length);
      expect(row.every((cell) => cell.trim().length > 0)).toBe(true);
    }
  });
});
