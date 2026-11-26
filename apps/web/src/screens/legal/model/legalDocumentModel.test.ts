import {
  LegalDocumentKind,
  type LegalDocumentResponse,
  type LegalDocumentSection,
  type LegalVersionComparison,
} from '@repo/shared/legal';
import { describe, expect, it } from 'vitest';
import { formatLegalDate } from '@/screens/ui/model/legalDates';
import {
  INTERNAL_COPY_PATTERN,
  RAW_ID_PATTERN,
  copyStrings,
} from '@/screens/ui/__tests__/userCopyChecks';
import {
  privacyComparison,
  privacyPage,
  privacyPreviousPage,
  privacyScheduledPage,
  privacyWithScheduledPage,
  sectionKindPage,
  termsPage,
  termsScheduledComparison,
} from '../__stories__/storyDocuments';
import {
  formatLegalCheckedAt,
  formatVersionPeriod,
  toLegalComparisonView,
  toLegalDocumentView,
  toLegalPageNotices,
  toLegalVersionRows,
} from './legalDocumentModel';
import {
  legalDocumentIntros,
  legalDocumentNames,
  legalScreenCopy,
  legalShellCopy,
} from './legalScreenCopy';

const PRIVACY = LegalDocumentKind.PRIVACY_POLICY;
const TERMS = LegalDocumentKind.TERMS_OF_SERVICE;

// The seed's privacy policy in force and its earlier version, the terms, and the section kind sample.
const documents: Array<[string, LegalDocumentResponse]> = [
  ['privacy policy in force', privacyPage.viewing],
  ['earlier privacy policy', privacyPreviousPage.viewing],
  ['terms of service', termsPage.viewing],
  ['section kind sample', sectionKindPage(TERMS).viewing],
];

function withoutIds(
  blocks: ReturnType<typeof toLegalDocumentView>['blocks'],
): LegalDocumentSection[] {
  return blocks.map((block) => {
    if (block.type !== 'heading') return block;
    return { type: block.type, level: block.level, text: block.text };
  });
}

describe('toLegalDocumentView', () => {
  it.each(documents)(
    'keeps every section of the %s in order and as written (G-LU1)',
    (_label, document) => {
      expect(withoutIds(toLegalDocumentView(document).blocks)).toEqual(document.sections);
    },
  );

  it.each(documents)(
    'lists every heading of the %s once, in order, with a unique id (G-LU3)',
    (_label, document) => {
      const view = toLegalDocumentView(document);
      const headings = document.sections.filter((section) => section.type === 'heading');
      expect(view.toc.map(({ level, text }) => ({ level, text }))).toEqual(
        headings.map(({ level, text }) => ({ level, text })),
      );
      expect(new Set(view.toc.map((item) => item.id)).size).toBe(view.toc.length);
    },
  );

  it('shows user dates, not raw ids (G-LU5, G-LU10)', () => {
    const { viewing } = privacyPage;
    const view = toLegalDocumentView(viewing);
    const rows = toLegalVersionRows(PRIVACY, privacyPage);
    expect(view.effectiveDate).toBe(formatLegalDate(viewing.effectiveAt));
    expect(view.lastModifiedDate).toBe('2026년 11월 20일');
    const shown = JSON.stringify([
      view.effectiveDate,
      view.lastModifiedDate,
      rows.map((row) => formatVersionPeriod(row.period)),
    ]);
    for (const raw of [viewing.id, viewing.version, viewing.versionKey]) {
      expect(shown).not.toContain(raw);
    }
  });
});

describe('the section kind sample', () => {
  it('holds every section kind and variant the contract allows', () => {
    const kinds = sectionKindPage(TERMS).viewing.sections.map((section) => {
      if (section.type === 'heading') return `heading-${section.level}`;
      if (section.type === 'list') return section.ordered ? 'list-ordered' : 'list-unordered';
      if (section.type === 'callout') return `callout-${section.tone}`;
      return section.type;
    });
    expect(new Set(kinds)).toEqual(
      new Set([
        'heading-2',
        'heading-3',
        'heading-4',
        'paragraph',
        'list-ordered',
        'list-unordered',
        'table',
        'callout-INFO',
        'callout-WARNING',
      ]),
    );
  });
});

describe('versions', () => {
  it('maps the page response to version rows with user periods and version addresses (G-LU5)', () => {
    const scheduledKey = privacyScheduledPage.viewing.versionKey;
    expect(toLegalVersionRows(PRIVACY, privacyWithScheduledPage)).toEqual([
      {
        versionKey: scheduledKey,
        status: 'scheduled',
        period: { from: scheduledKey, until: null },
        href: `/privacy?version=${scheduledKey}`,
        viewing: false,
      },
      {
        versionKey: '2026-11-20',
        status: 'current',
        period: { from: '2026-11-20', until: privacyWithScheduledPage.viewing.appliesUntil },
        href: '/privacy',
        viewing: true,
      },
      {
        versionKey: '2026-06-22',
        status: 'previous',
        period: { from: '2026-06-22', until: '2026-11-19' },
        href: '/privacy?version=2026-06-22',
        viewing: false,
      },
    ]);
    expect(
      toLegalVersionRows(PRIVACY, privacyPreviousPage).map(({ versionKey, viewing }) => [
        versionKey,
        viewing,
      ]),
    ).toEqual([
      ['2026-11-20', false],
      ['2026-06-22', true],
    ]);
  });

  it('gives a closed period both ends and the version in force its start', () => {
    expect(formatVersionPeriod({ from: '2026-06-22', until: '2026-11-19' })).toBe(
      '2026년 6월 22일 ~ 2026년 11월 19일',
    );
    expect(formatVersionPeriod({ from: '2026-11-20', until: null })).toBe('2026년 11월 20일부터');
  });

  it('announces a scheduled version only on the version in force (G-LU5)', () => {
    const scheduledKey = privacyScheduledPage.viewing.versionKey;
    expect(toLegalPageNotices(PRIVACY, privacyPage)).toEqual([]);
    expect(toLegalPageNotices(PRIVACY, privacyWithScheduledPage)).toEqual([
      { kind: 'scheduled', appliesFrom: scheduledKey, href: `/privacy?version=${scheduledKey}` },
    ]);
    // `scheduled` comes with every page; another version's page shows which one it is instead.
    expect(privacyScheduledPage.scheduled).not.toBeNull();
    expect(toLegalPageNotices(PRIVACY, privacyScheduledPage)).toEqual([
      {
        kind: 'other-version',
        status: 'scheduled',
        period: { from: scheduledKey, until: null },
        currentHref: '/privacy',
      },
    ]);
    expect(toLegalPageNotices(PRIVACY, privacyPreviousPage)).toEqual([
      {
        kind: 'other-version',
        status: 'previous',
        period: { from: '2026-06-22', until: '2026-11-19' },
        currentHref: '/privacy',
      },
    ]);
  });
});

describe('the comparison with the version before', () => {
  const section = (text: string): LegalDocumentSection => ({ type: 'paragraph', text });
  const article = (
    heading: string | null,
    change: LegalVersionComparison['articles'][number]['change'],
  ) => ({ heading, change, before: [section(`${heading} 전`)], after: [section(`${heading} 후`)] });

  it('keeps only the changed articles, in order, for the comparison (G-LU5)', () => {
    const view = toLegalComparisonView({
      kind: PRIVACY,
      versionKey: '2026-12-14',
      previousVersionKey: '2026-11-20',
      articles: [
        article(null, 'changed'),
        article('제1조', 'unchanged'),
        article('제2조', 'changed'),
        article('제3조', 'added'),
        article('제4조', 'unchanged'),
        article('제5조', 'removed'),
      ],
    });
    expect(view).toEqual({
      state: 'table',
      articles: [
        article(null, 'changed'),
        article('제2조', 'changed'),
        article('제3조', 'added'),
        article('제5조', 'removed'),
      ],
    });

    const seedView = toLegalComparisonView(privacyComparison);
    const changed = privacyComparison.articles.filter((item) => item.change !== 'unchanged');
    expect(seedView).toEqual({ state: 'table', articles: changed });
    expect(changed.length).toBeGreaterThan(0);
  });

  it('says when no article changed, when there is no version before and when it cannot be read', () => {
    expect(toLegalComparisonView(termsScheduledComparison)).toEqual({ state: 'unchanged' });
    expect(
      toLegalComparisonView({
        kind: TERMS,
        versionKey: '2026-06-22',
        previousVersionKey: null,
        articles: [],
      }),
    ).toEqual({ state: 'first' });
    expect(toLegalComparisonView(null)).toEqual({ state: 'unavailable' });
  });
});

describe('screen copy', () => {
  it('writes the check time of a kept copy in Korean time', () => {
    expect(formatLegalCheckedAt('2026-11-25T09:30:00.000Z')).toBe('2026년 11월 25일 18:30');
    expect(formatLegalCheckedAt('2026-11-30T15:05:00.000Z')).toBe('2026년 12월 1일 00:05');
  });

  it('names no plan, issue, internal path, raw id or internal state in screen copy (G-LU10)', () => {
    const strings = copyStrings(
      { legalScreenCopy, legalShellCopy, legalDocumentNames, legalDocumentIntros },
      [formatLegalDate('2026-12-14'), formatLegalCheckedAt('2026-11-25T09:30:00.000Z')],
    );
    expect(strings.length).toBeGreaterThan(40);
    for (const text of strings) {
      expect(text).not.toMatch(INTERNAL_COPY_PATTERN);
      expect(text).not.toMatch(RAW_ID_PATTERN);
    }
  });
});
