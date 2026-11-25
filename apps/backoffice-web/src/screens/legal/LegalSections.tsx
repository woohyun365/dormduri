import type { ReactNode } from 'react';
import type { LegalArticleComparison, LegalDocumentSection } from '@repo/shared/legal';
import { StatusBadge, type Meaning } from '@/ui/status';
import { TableRegion, TD, TH } from '@/ui/table';

// A legal document body the way the public screens draw it (apps/web legal sections): every section type in its own
// element and every text as written, never cut short. HTML is never read from the text (legal README Hard rule).

const HEADING_CLASS: Record<2 | 3 | 4, string> = {
  2: 'text-title-2 font-bold text-fg-neutral',
  3: 'text-body font-semibold text-fg-neutral',
  4: 'text-label font-semibold text-fg-label',
};

function Heading({
  level,
  offset,
  plain,
  children,
}: {
  readonly level: 2 | 3 | 4;
  /** How many levels the page's own outline adds above the document (a card's h2 makes 1). */
  readonly offset: number;
  /** Inside a comparison cell the heading is a bold line, so the page outline keeps its own headings. */
  readonly plain: boolean;
  readonly children: ReactNode;
}) {
  if (plain) return <p className={HEADING_CLASS[level]}>{children}</p>;
  const Tag = `h${Math.min(level + offset, 6)}` as 'h3' | 'h4' | 'h5' | 'h6';
  return <Tag className={HEADING_CLASS[level]}>{children}</Tag>;
}

function Section({
  section,
  offset,
  plain,
}: {
  readonly section: LegalDocumentSection;
  readonly offset: number;
  readonly plain: boolean;
}) {
  switch (section.type) {
    case 'heading':
      return (
        <Heading level={section.level} offset={offset} plain={plain}>
          {section.text}
        </Heading>
      );
    case 'paragraph':
      return <p className="text-body text-fg-description">{section.text}</p>;
    case 'list': {
      const List = section.ordered ? 'ol' : 'ul';
      return (
        <List
          className={`flex flex-col gap-1 pl-5 text-body text-fg-description ${section.ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {section.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </List>
      );
    }
    case 'table': {
      // Inside a comparison cell the table wraps its headers and breaks a long word in its cell, so the comparison
      // keeps to its column instead of scrolling (design guide ⑦).
      const th = plain
        ? 'bg-layer-muted px-2 py-1 text-left text-label font-semibold text-fg-muted wrap-anywhere'
        : TH;
      const td = plain ? 'px-2 py-1 text-table text-fg-neutral wrap-anywhere' : TD;
      const table = (
        <table className="w-full border-collapse rounded-control border border-stroke-subtle">
          {section.caption ? (
            <caption className="pb-2 text-left text-label font-semibold text-fg-label">
              {section.caption}
            </caption>
          ) : null}
          <thead>
            <tr>
              {section.headers.map((header, index) => (
                <th key={index} scope="col" className={th}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-row">
            {section.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={td}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      return plain ? table : <TableRegion label={section.caption ?? '표'}>{table}</TableRegion>;
    }
    case 'callout':
      return (
        <p
          className={`rounded-card border px-4 py-3 text-body ${
            section.tone === 'WARNING'
              ? 'border-stroke-warning bg-warning-weak text-fg-warning'
              : 'border-stroke-info bg-info-weak text-fg-info'
          }`}
        >
          {section.text}
        </p>
      );
  }
}

/** The sections of a body in order; `offset` nests the document's headings under the page's own. */
export function LegalSectionsView({
  sections,
  offset = 1,
  plain = false,
}: {
  readonly sections: readonly LegalDocumentSection[];
  readonly offset?: number;
  readonly plain?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => (
        <Section key={index} section={section} offset={offset} plain={plain} />
      ))}
    </div>
  );
}

/** A whole document in its stored order: the title, the summary items and the body. */
export function LegalDocumentView({
  label,
  title,
  summaryItems,
  sections,
}: {
  /** The article's accessible name (`미리보기`, `본문`, `본문 전체`). */
  readonly label: string;
  readonly title: string;
  readonly summaryItems: readonly string[];
  readonly sections: readonly LegalDocumentSection[];
}) {
  return (
    <article aria-label={label} className="flex flex-col gap-4">
      <h3 className="text-title-2 font-bold text-fg-neutral">{title || '제목 없음'}</h3>
      {summaryItems.length ? (
        <ul className="flex list-disc flex-col gap-1 rounded-card bg-layer-muted py-3 pr-4 pl-9 text-body text-fg-label">
          {summaryItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
      <LegalSectionsView sections={sections} offset={2} />
    </article>
  );
}

const CHANGE: Record<LegalArticleComparison['change'], { label: string; meaning: Meaning }> = {
  added: { label: '더함', meaning: 'success' },
  removed: { label: '지움', meaning: 'warning' },
  changed: { label: '바뀜', meaning: 'info' },
  unchanged: { label: '같음', meaning: 'pending' },
};

/**
 * The article comparison table the backoffice API computed (the public `/comparison` calculation): one row per article
 * with its change and the sections before and after. An unchanged article says so instead of repeating its text.
 */
export function ComparisonTable({
  articles,
}: {
  readonly articles: readonly LegalArticleComparison[];
}) {
  const changed = articles.filter((article) => article.change !== 'unchanged').length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-fg-label tabular-nums">
        조항 {articles.length}개 가운데 바뀐 조항 {changed}개
      </p>
      <TableRegion label="조항 대조표 영역">
        <table aria-label="조항 대조표" className="w-full min-w-160 border-collapse lg:min-w-0">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                조항
              </th>
              <th scope="col" className={TH}>
                변경
              </th>
              <th scope="col" className={TH}>
                앞 판
              </th>
              <th scope="col" className={TH}>
                이 판
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-row align-top">
            {articles.map((article, index) => (
              <tr key={index}>
                <th scope="row" className={`${TD} text-left font-semibold wrap-anywhere`}>
                  {article.heading ?? '첫 조항 앞'}
                </th>
                <td className={TD}>
                  <StatusBadge meaning={CHANGE[article.change].meaning}>
                    {CHANGE[article.change].label}
                  </StatusBadge>
                </td>
                {article.change === 'unchanged' ? (
                  <td colSpan={2} className={`${TD} text-fg-muted wrap-anywhere`}>
                    앞 판과 같습니다.
                  </td>
                ) : (
                  <>
                    <td className={`${TD} wrap-anywhere`}>
                      {article.before.length ? (
                        <LegalSectionsView sections={article.before} plain />
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className={`${TD} wrap-anywhere`}>
                      {article.after.length ? (
                        <LegalSectionsView sections={article.after} plain />
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
    </div>
  );
}
