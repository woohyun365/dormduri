import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LegalDocumentKind,
  type LegalDocumentSection,
  type LegalVersionComparison,
} from '@repo/shared/legal';
import { formatLegalDate } from '@/screens/ui/model/legalDates';
import {
  LegalDocumentScreen,
  LegalUnavailableScreen,
  LegalVersionNotFoundScreen,
  type LegalDocumentScreenProps,
} from '../index';
import {
  STORY_CHECKED_AT,
  firstVersionComparison,
  privacyComparison,
  privacyPage,
  privacyPreviousComparison,
  privacyPreviousPage,
  privacyScheduledComparison,
  privacyScheduledPage,
  privacyWithScheduledPage,
  sectionKindPage,
  termsComparison,
  termsPage,
  termsScheduledComparison,
  termsScheduledPage,
} from '../__stories__/storyDocuments';
import {
  formatLegalCheckedAt,
  MAJOR_CHANGE_LABEL,
  toLegalChangeSummaryView,
} from '../model/legalDocumentModel';
import {
  legalDocumentIntros,
  legalDocumentNames,
  legalScreenCopy,
  legalShellCopy,
} from '../model/legalScreenCopy';

const PRIVACY = LegalDocumentKind.PRIVACY_POLICY;
const TERMS = LegalDocumentKind.TERMS_OF_SERVICE;
const published = { kind: 'published' } as const;

function renderScreen(props: Partial<LegalDocumentScreenProps> = {}) {
  return render(
    <LegalDocumentScreen
      page={privacyPage}
      source={published}
      comparison={privacyComparison}
      {...props}
    />,
  );
}

function follows(first: Node, second: Node): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function sectionText(section: LegalDocumentSection): string[] {
  switch (section.type) {
    case 'heading':
    case 'paragraph':
    case 'callout':
      return [section.text];
    case 'list':
      return section.items;
    case 'table':
      return [section.caption ?? '', ...section.headers, ...section.rows.flat()].filter(Boolean);
  }
}

// Every text in order inside `text`: each one found after the one before.
function expectInOrder(text: string, parts: string[]) {
  let from = 0;
  for (const part of parts) {
    const at = text.indexOf(part, from);
    expect(at, part).toBeGreaterThanOrEqual(0);
    from = at + part.length;
  }
}

function bodyHeadings(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'h2[id^="section-"], h3[id^="section-"], h4[id^="section-"]',
    ),
  ];
}

function comparisonRegion() {
  return screen.getByRole('region', { name: legalScreenCopy.comparisonTitle });
}

function articleOf(region: HTMLElement, heading: string | null, change: string): HTMLElement {
  const name = `${heading ?? legalScreenCopy.comparisonPreambleLabel} ${legalScreenCopy.articleChangeLabel[change as 'added' | 'removed' | 'changed']}`;
  const title = within(region).getByRole('heading', { level: 3, name });
  const article = title.closest('article');
  if (!article) throw new Error(`no article for ${name}`);
  return article;
}

function columnOf(article: HTMLElement, label: string): HTMLElement {
  const column = within(article).getByText(label, { selector: 'p' }).parentElement;
  if (!column) throw new Error(`no column ${label}`);
  return column;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('legal document screen', () => {
  it('renders every section kind in source order, text as written (G-LU1)', () => {
    const page = sectionKindPage(PRIVACY);
    const { container } = renderScreen({
      page,
      comparison: firstVersionComparison(PRIVACY, '2026-06-22'),
    });

    const elements = page.viewing.sections.map((section) => {
      switch (section.type) {
        case 'heading':
          return screen.getByRole('heading', { level: section.level, name: section.text });
        case 'paragraph':
          return screen.getByText(section.text, { selector: 'p' });
        case 'list': {
          const list = screen
            .getByText(section.items[0] ?? '')
            .closest(section.ordered ? 'ol' : 'ul');
          expect(list).not.toBeNull();
          expect(
            within(list as HTMLElement)
              .getAllByRole('listitem')
              .map((item) => item.textContent),
          ).toEqual(section.items);
          return list as HTMLElement;
        }
        case 'table': {
          const table = screen.getByRole('table', { name: section.caption });
          expect(
            within(table)
              .getAllByRole('columnheader')
              .map((cell) => cell.textContent),
          ).toEqual(section.headers);
          expect(
            within(table)
              .getAllByRole('cell')
              .map((cell) => cell.textContent),
          ).toEqual(section.rows.flat());
          return table;
        }
        case 'callout': {
          const note = screen.getByText(section.text, { exact: false, selector: '[role="note"]' });
          return note;
        }
      }
    });
    for (let index = 1; index < elements.length; index += 1) {
      expect(
        follows(elements[index - 1] as Node, elements[index] as Node),
        `section ${index}`,
      ).toBe(true);
    }
    expect(bodyHeadings(container).map((heading) => heading.textContent)).toEqual(
      page.viewing.sections.flatMap((section) =>
        section.type === 'heading' ? [section.text] : [],
      ),
    );
  });

  it("draws each changed article's text as written in both columns (G-LU1, G-LU5)", () => {
    renderScreen({ page: privacyScheduledPage, comparison: privacyScheduledComparison });
    const region = comparisonRegion();
    const changed = privacyScheduledComparison.articles.filter(
      (item) => item.change !== 'unchanged',
    );
    expect(changed.length).toBeGreaterThan(0);

    for (const item of changed) {
      const article = articleOf(region, item.heading, item.change);
      for (const [label, sections] of [
        [legalScreenCopy.comparisonBeforeLabel, item.before],
        [legalScreenCopy.comparisonAfterLabel, item.after],
      ] as const) {
        const column = columnOf(article, label);
        if (sections.length === 0) {
          expect(column).toHaveTextContent(legalScreenCopy.comparisonEmptyLabel);
        } else {
          expectInOrder(column.textContent ?? '', sections.flatMap(sectionText));
        }
      }
    }
  });

  it("has one h1, the document's own title (G-LU2)", () => {
    const { container } = renderScreen({ page: termsPage, comparison: termsComparison });

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(termsPage.viewing.title);
  });

  it('reads title, introduction, contents and body in that order (G-LU3)', () => {
    const { container } = renderScreen();
    const title = screen.getByRole('heading', { level: 1 });
    const intro = screen.getByText(legalDocumentIntros[PRIVACY]);
    const [contents] = screen.getAllByRole('navigation', { name: legalScreenCopy.tocLabel });
    const [firstHeading] = bodyHeadings(container);

    expect(contents).toBeDefined();
    expect(firstHeading).toBeDefined();
    expect(follows(title, intro)).toBe(true);
    expect(follows(intro, contents as Node)).toBe(true);
    expect(follows(contents as Node, firstHeading as Node)).toBe(true);
  });

  it('links every contents entry to its body heading (G-LU3)', () => {
    renderScreen();
    const navs = screen.getAllByRole('navigation', { name: legalScreenCopy.tocLabel });
    expect(navs).toHaveLength(2);
    const headings = privacyPage.viewing.sections.filter((section) => section.type === 'heading');

    for (const nav of navs) {
      const links = within(nav).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(
        headings.map((heading) => heading.text),
      );
      links.forEach((link, index) => {
        const id = decodeURIComponent((link.getAttribute('href') ?? '').slice(1));
        const target = document.getElementById(id);
        expect(target?.tagName).toBe(`H${headings[index]?.level}`);
        expect(target).toHaveTextContent(headings[index]?.text ?? '');
      });
    }
  });

  it('keeps comparison headings out of the contents and under the comparison heading (G-LU3)', () => {
    renderScreen({ page: privacyScheduledPage, comparison: privacyScheduledComparison });
    const region = comparisonRegion();
    const sectionHeading = within(region).getByRole('heading', { level: 2 });
    const tocTargets = new Set(
      screen
        .getAllByRole('navigation', { name: legalScreenCopy.tocLabel })
        .flatMap((nav) => within(nav).getAllByRole('link'))
        .map((link) => decodeURIComponent((link.getAttribute('href') ?? '').slice(1))),
    );

    const inside = within(region)
      .getAllByRole('heading')
      .filter((heading) => heading !== sectionHeading);
    expect(inside.length).toBeGreaterThan(0);
    for (const heading of inside) {
      expect(Number(heading.tagName.slice(1))).toBeGreaterThan(2);
      expect(tocTargets.has(heading.id)).toBe(false);
    }
    expect(tocTargets.size).toBe(
      privacyScheduledPage.viewing.sections.filter((section) => section.type === 'heading').length,
    );
  });

  it('sets callouts and notices apart with a text label, not color alone (G-LU4)', () => {
    renderScreen({
      page: sectionKindPage(PRIVACY),
      comparison: firstVersionComparison(PRIVACY, '2026-06-22'),
      source: { kind: 'last-success', checkedAt: STORY_CHECKED_AT },
    });
    const callouts = sectionKindPage(PRIVACY).viewing.sections.filter(
      (section): section is Extract<LegalDocumentSection, { type: 'callout' }> =>
        section.type === 'callout',
    );
    for (const callout of callouts) {
      const note = screen.getByText(callout.text, { exact: false, selector: '[role="note"]' });
      const label = legalScreenCopy.noticeLabel[callout.tone];
      expect(note.querySelector('strong')).toHaveTextContent(label);
      expect(note.textContent?.startsWith(label)).toBe(true);
    }
    const status = screen
      .getAllByRole('status')
      .find((element) => element.textContent?.includes(formatLegalCheckedAt(STORY_CHECKED_AT)));
    expect(status?.querySelector('strong')).toHaveTextContent(legalScreenCopy.noticeLabel.INFO);
  });

  it('shows the dates in user words and the change summary (G-LU5)', () => {
    const { container } = renderScreen();
    const { viewing } = privacyPage;

    expect(screen.getByText(legalScreenCopy.effectiveLabel).nextElementSibling).toHaveTextContent(
      formatLegalDate(viewing.effectiveAt),
    );
    expect(
      screen.getByText(legalScreenCopy.lastModifiedLabel).nextElementSibling,
    ).toHaveTextContent(formatLegalDate(viewing.lastModifiedAt));
    const { summary, majorChanges } = toLegalChangeSummaryView(viewing.changeSummary ?? '');
    for (const text of [summary, ...majorChanges]) {
      if (text) expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
    }
    for (const raw of [viewing.id, viewing.version, viewing.versionKey]) {
      expect(container.textContent).not.toContain(raw);
    }
  });

  it('shows the lead sentence, then the major changes under their label as the one title (Owner 2026-11-26)', () => {
    renderScreen();
    const text = privacyPage.viewing.changeSummary ?? '';
    const marker = text.indexOf(`${MAJOR_CHANGE_LABEL}:`);
    expect(marker).toBeGreaterThan(0);
    const lead = text.slice(0, marker).trim();
    const changes = text
      .slice(marker + MAJOR_CHANGE_LABEL.length + 1)
      .trim()
      .split(/(?<=다\.)\s+/);
    expect(changes.length).toBeGreaterThan(1);

    expect(screen.queryByText(legalScreenCopy.changeSummaryLabel)).toBeNull();
    const line = screen.getByText(lead);
    const list = screen.getByRole('list', { name: MAJOR_CHANGE_LABEL });
    const label = screen.getByText(MAJOR_CHANGE_LABEL);
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(changes);
    expect(follows(line, label)).toBe(true);
    expect(follows(label, list)).toBe(true);
    const link = screen.getByRole('link', { name: legalScreenCopy.comparisonLinkLabel });
    expect(follows(list, link)).toBe(true);
  });

  it('titles a change summary without the major-change marker once, on its own line (Owner 2026-11-26)', () => {
    renderScreen({ page: termsPage, comparison: termsComparison });
    const text = termsPage.viewing.changeSummary ?? '';
    expect(text).not.toContain(`${MAJOR_CHANGE_LABEL}:`);
    const title = screen.getByText(legalScreenCopy.changeSummaryLabel);
    const body = screen.getByText(text);
    expect(body).not.toContainElement(title);
    expect(follows(title, body)).toBe(true);
    expect(screen.queryByRole('list', { name: MAJOR_CHANGE_LABEL })).toBeNull();
  });

  it('starts each sentence of a version notice on its own line after the label (Owner 2026-11-26)', () => {
    const scheduledKey = privacyScheduledPage.viewing.versionKey;
    const cases = [
      {
        page: privacyScheduledPage,
        comparison: privacyScheduledComparison,
        label: legalScreenCopy.versionStatusLabel.scheduled,
        sentences: legalScreenCopy.viewingScheduledNotice(formatLegalDate(scheduledKey)),
      },
      {
        page: privacyPreviousPage,
        comparison: privacyPreviousComparison,
        label: legalScreenCopy.versionStatusLabel.previous,
        sentences: legalScreenCopy.viewingPreviousNotice(
          formatLegalDate('2026-06-22'),
          formatLegalDate('2026-11-19'),
        ),
      },
    ];
    for (const { page, comparison, label, sentences } of cases) {
      const shown = renderScreen({ page, comparison });
      const link = screen.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel });
      const note = link.closest('[role="note"]') as HTMLElement;
      const parts = [
        within(note).getByText(label),
        ...sentences.map((sentence) => within(note).getByText(sentence)),
        link,
      ];
      expect(sentences).toHaveLength(2);
      parts.reduce((before, part) => {
        expect(follows(before, part)).toBe(true);
        return part;
      });
      shown.unmount();
    }
  });

  it('lists the periods of application and links the other versions (G-LU5)', () => {
    renderScreen({ page: privacyWithScheduledPage });
    const list = screen.getByRole('region', { name: legalScreenCopy.versionsTitle });
    const rows = within(list).getAllByRole('listitem');
    const scheduledKey = privacyScheduledPage.viewing.versionKey;
    const labels = legalScreenCopy.versionStatusLabel;

    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent(labels.current);
    expect(rows[1]).toHaveTextContent(legalScreenCopy.viewingVersionLabel);
    expect(within(rows[1] as HTMLElement).queryByRole('link')).toBeNull();
    expect(
      within(list).getByRole('link', {
        name: `${labels.scheduled} ${formatLegalDate(scheduledKey)}부터 ${legalScreenCopy.viewVersionLabel}`,
      }),
    ).toHaveAttribute('href', `/privacy?version=${scheduledKey}`);
    expect(
      within(list).getByRole('link', {
        name: `${labels.previous} 2026년 6월 22일 ~ 2026년 11월 19일 ${legalScreenCopy.viewVersionLabel}`,
      }),
    ).toHaveAttribute('href', '/privacy?version=2026-06-22');
  });

  it('announces a scheduled version only on the version in force and says which version is in force on another one (G-LU5)', () => {
    const scheduledKey = privacyScheduledPage.viewing.versionKey;
    const { unmount } = renderScreen({ page: privacyWithScheduledPage });
    const announcement = screen.getByRole('link', { name: legalScreenCopy.scheduledLinkLabel });
    expect(announcement).toHaveAttribute('href', `/privacy?version=${scheduledKey}`);
    expect(announcement.closest('[role="note"]')).toHaveTextContent(legalScreenCopy.scheduledLabel);
    unmount();

    const scheduled = renderScreen({
      page: privacyScheduledPage,
      comparison: privacyScheduledComparison,
    });
    expect(screen.queryByRole('link', { name: legalScreenCopy.scheduledLinkLabel })).toBeNull();
    const current = screen.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel });
    expect(current).toHaveAttribute('href', '/privacy');
    expect(current.closest('[role="note"]')).toHaveTextContent(
      legalScreenCopy.versionStatusLabel.scheduled,
    );
    scheduled.unmount();

    const previous = renderScreen({
      page: privacyPreviousPage,
      comparison: privacyPreviousComparison,
    });
    expect(
      screen
        .getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel })
        .closest('[role="note"]'),
    ).toHaveTextContent(legalScreenCopy.versionStatusLabel.previous);
    previous.unmount();

    renderScreen();
    expect(
      screen.queryByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel }),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: legalScreenCopy.scheduledLinkLabel })).toBeNull();
  });

  it('compares the changed articles with the version before (G-LU5)', () => {
    const comparison: LegalVersionComparison = {
      ...privacyComparison,
      articles: [
        ...privacyComparison.articles,
        {
          heading: '제12조(새 조항)',
          change: 'added',
          before: [],
          after: [
            { type: 'heading', level: 2, text: '제12조(새 조항)' },
            { type: 'paragraph', text: '더한 조항의 글입니다.' },
          ],
        },
        {
          heading: '제13조(지운 조항)',
          change: 'removed',
          before: [
            { type: 'heading', level: 2, text: '제13조(지운 조항)' },
            { type: 'paragraph', text: '뺀 조항의 글입니다.' },
          ],
          after: [],
        },
      ],
    };
    renderScreen({ comparison });
    const region = comparisonRegion();
    const sectionHeading = within(region).getByRole('heading', {
      level: 2,
      name: legalScreenCopy.comparisonTitle,
    });

    const changed = comparison.articles.filter((item) => item.change !== 'unchanged');
    expect(
      within(region)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(
      changed.map(
        (item) =>
          `${item.heading ?? legalScreenCopy.comparisonPreambleLabel} ${legalScreenCopy.articleChangeLabel[item.change as 'added' | 'removed' | 'changed']}`,
      ),
    );
    const added = articleOf(region, '제12조(새 조항)', 'added');
    expect(columnOf(added, legalScreenCopy.comparisonBeforeLabel)).toHaveTextContent(
      legalScreenCopy.comparisonEmptyLabel,
    );
    expect(columnOf(added, legalScreenCopy.comparisonAfterLabel)).toHaveTextContent(
      '더한 조항의 글입니다.',
    );
    const removed = articleOf(region, '제13조(지운 조항)', 'removed');
    expect(columnOf(removed, legalScreenCopy.comparisonAfterLabel)).toHaveTextContent(
      legalScreenCopy.comparisonEmptyLabel,
    );

    const link = screen.getByRole('link', { name: legalScreenCopy.comparisonLinkLabel });
    expect(link.getAttribute('href')).toBe(`#${sectionHeading.id}`);
    expect(follows(screen.getByRole('heading', { level: 1 }), link)).toBe(true);
  });

  it('says when the articles are unchanged, when there is no version before and when the comparison cannot be read (G-LU5)', () => {
    const unchanged = renderScreen({
      page: termsScheduledPage,
      comparison: termsScheduledComparison,
    });
    expect(comparisonRegion()).toHaveTextContent(legalScreenCopy.comparisonUnchanged);
    expect(screen.queryByRole('link', { name: legalScreenCopy.comparisonLinkLabel })).toBeNull();
    unchanged.unmount();

    const first = renderScreen({ page: termsPage, comparison: termsComparison });
    expect(termsComparison.previousVersionKey).toBeNull();
    expect(screen.queryByRole('region', { name: legalScreenCopy.comparisonTitle })).toBeNull();
    first.unmount();

    renderScreen({ page: termsScheduledPage, comparison: null });
    expect(comparisonRegion()).toHaveTextContent(legalScreenCopy.comparisonUnavailable);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      termsScheduledPage.viewing.title,
    );
    expect(screen.queryByRole('link', { name: legalScreenCopy.comparisonLinkLabel })).toBeNull();
  });

  it("offers printing and copying this page's address (G-LU6)", async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: legalScreenCopy.printLabel }));
    expect(print).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: legalScreenCopy.copyLinkLabel }));
    await waitFor(() => expect(screen.getByText(legalScreenCopy.copyLinkDone)).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(window.location.href);

    writeText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: legalScreenCopy.copyLinkLabel }));
    await waitFor(() =>
      expect(screen.getByText(legalScreenCopy.copyLinkUnavailable)).toBeInTheDocument(),
    );
  });

  it('shows the last-confirmed notice with its check time only for a last-confirmed copy (G-LU7)', () => {
    const notice = legalScreenCopy.lastSuccessNotice;
    const shown = renderScreen();
    expect(screen.queryByText(notice)).toBeNull();
    expect(screen.queryByText(/마지막으로 확인한/)).toBeNull();
    shown.unmount();

    // Two short lines: what is shown, then the check time under its own label (Owner 2026-11-26).
    renderScreen({ source: { kind: 'last-success', checkedAt: STORY_CHECKED_AT } });
    const status = screen.getByText(notice).closest('[role="status"]');
    expect(status).not.toBeNull();
    const label = within(status as HTMLElement).getByText(legalScreenCopy.checkedAtLabel);
    expect(status).toHaveTextContent(
      `${notice}${legalScreenCopy.checkedAtLabel}2026년 11월 25일 18:30`,
    );
    expect(follows(screen.getByText(notice), label)).toBe(true);
  });

  it('shows the unavailable page with the document name, retry, home and the inquiry address (G-LU7)', () => {
    render(<LegalUnavailableScreen kind={TERMS} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      `${legalDocumentNames[TERMS]}${legalScreenCopy.unavailableTitleSuffix}`,
    );
    expect(
      screen.getByRole('link', { name: legalScreenCopy.unavailableRetryLabel }),
    ).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: legalScreenCopy.homeActionLabel })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByText(legalShellCopy.inquiryAddress, { selector: 'main span' }),
    ).toBeInTheDocument();
  });

  it('shows the version-not-found page with the current version, home and the inquiry address (G-LU7)', () => {
    render(<LegalVersionNotFoundScreen kind={PRIVACY} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      `${legalDocumentNames[PRIVACY]}${legalScreenCopy.versionNotFoundTitleSuffix}`,
    );
    expect(
      screen.getByRole('link', { name: legalScreenCopy.viewCurrentVersionLabel }),
    ).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: legalScreenCopy.homeActionLabel })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByText(legalShellCopy.inquiryAddress, { selector: 'main span' }),
    ).toBeInTheDocument();
  });

  it('keeps both documents in the header, marks the current one and names the privacy policy by law (G-LU11)', () => {
    renderScreen();
    const nav = screen.getByRole('navigation', { name: legalScreenCopy.documentNavLabel });

    // The name the law gives the privacy policy (LB-R1), pinned as written (fe.ds.copy-authority).
    const privacy = within(nav).getByRole('link', { name: '개인정보 처리방침' });
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(privacy).toHaveAttribute('aria-current', 'page');
    const terms = within(nav).getByRole('link', { name: legalDocumentNames[TERMS] });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).not.toHaveAttribute('aria-current');
  });

  it('puts the header controls in the order they are seen: logo, the documents, back (WCAG 2.4.3)', () => {
    renderScreen();
    const header = screen
      .getByRole('link', { name: legalScreenCopy.homeLabel })
      .closest('header') as HTMLElement;
    const names = within(header)
      .getAllByRole('link')
      .concat(within(header).queryAllByRole('button'))
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim());

    expect(names).toEqual([
      legalScreenCopy.homeLabel,
      legalDocumentNames[TERMS],
      legalDocumentNames[PRIVACY],
      legalScreenCopy.backLabel,
    ]);
  });

  it('lists a sentence the change summary repeats as its own item, without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const repeated = '표를 고쳤습니다.';
    renderScreen({
      page: {
        ...privacyPage,
        viewing: {
          ...privacyPage.viewing,
          changeSummary: `${MAJOR_CHANGE_LABEL}: ${repeated} ${repeated}`,
        },
      },
    });

    const list = screen.getByRole('list', { name: MAJOR_CHANGE_LABEL });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([repeated, repeated]);
    expect(error.mock.calls.flat().map(String).join(' ')).not.toContain('same key');
  });

  it('links home only through the header logo (D-LU7)', () => {
    const { container } = renderScreen();
    const homeLinks = [...container.querySelectorAll('a[href="/"]')];

    expect(homeLinks).toHaveLength(1);
    const logo = screen.getByRole('link', { name: legalScreenCopy.homeLabel });
    expect(homeLinks[0]).toBe(logo);
    expect(within(logo).getAllByRole('img')).toHaveLength(1);
  });

  it('marks only a shown document with its source for the Web deploy check', () => {
    const mark = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-dormduri-legal-source]')].map((element) =>
        element.getAttribute('data-dormduri-legal-source'),
      );
    const shown = renderScreen();
    expect(mark(shown.container)).toEqual(['published']);
    shown.unmount();

    const kept = renderScreen({ source: { kind: 'last-success', checkedAt: STORY_CHECKED_AT } });
    expect(mark(kept.container)).toEqual(['last-success']);
    kept.unmount();

    expect(mark(render(<LegalUnavailableScreen kind={PRIVACY} />).container)).toEqual([]);
    expect(mark(render(<LegalVersionNotFoundScreen kind={PRIVACY} />).container)).toEqual([]);
  });
});
