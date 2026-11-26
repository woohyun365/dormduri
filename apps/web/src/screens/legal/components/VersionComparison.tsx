import type { LegalDocumentSection } from '@repo/shared/legal';
import type { LegalComparisonArticle, LegalComparisonView } from '../model/legalDocumentModel';
import { legalScreenCopy } from '../model/legalScreenCopy';
import { DocumentBody, headingJumpClass } from './DocumentBody';

export const legalComparisonHeadingId = 'legal-comparison';

// '이전 판과 달라진 조항': after the body and before the version list, on a version that has one
// before it (D-LU18). Only the changed, added and removed articles, in their order; for each, the
// article and its change, then the version before and this version side by side from lg, one above the
// other below it. The columns draw the sections as written with the body renderer (G-LU1); their
// headings sit under the article heading and stay out of the contents (G-LU3). An added article has
// nothing before, a removed one nothing in this version. A first version has no section.
export function VersionComparison({ view }: { view: LegalComparisonView }) {
  if (view.state === 'first') return null;
  return (
    <section
      aria-labelledby={legalComparisonHeadingId}
      className="mt-16 border-t border-stroke-subtle pt-6"
    >
      <h2
        id={legalComparisonHeadingId}
        className={`text-title-3 font-bold text-balance break-keep ${headingJumpClass}`}
      >
        {legalScreenCopy.comparisonTitle}
      </h2>
      {view.state === 'table' ? (
        <ol className="mt-6 space-y-10">
          {view.articles.map((article, index) => (
            <li key={`${article.heading ?? ''}-${index}`}>
              <ComparedArticle article={article} index={index} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-body text-fg-muted break-keep">
          {view.state === 'unchanged'
            ? legalScreenCopy.comparisonUnchanged
            : legalScreenCopy.comparisonUnavailable}
        </p>
      )}
    </section>
  );
}

function ComparedArticle({ article, index }: { article: LegalComparisonArticle; index: number }) {
  return (
    <article className="space-y-4">
      <h3 className="flex flex-wrap items-baseline gap-x-3 text-body font-bold break-keep wrap-anywhere">
        <span>{article.heading ?? legalScreenCopy.comparisonPreambleLabel}</span>{' '}
        <span className="rounded-control border border-stroke-neutral px-2 text-body-sm font-medium">
          {legalScreenCopy.articleChangeLabel[article.change]}
        </span>
      </h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <Column
          label={legalScreenCopy.comparisonBeforeLabel}
          sections={article.before}
          idPrefix={`comparison-${index}-before`}
        />
        <Column
          label={legalScreenCopy.comparisonAfterLabel}
          sections={article.after}
          idPrefix={`comparison-${index}-after`}
        />
      </div>
    </article>
  );
}

function Column({
  label,
  sections,
  idPrefix,
}: {
  label: string;
  sections: LegalDocumentSection[];
  idPrefix: string;
}) {
  return (
    <div className="min-w-0 rounded-control border border-stroke-subtle px-4 py-3">
      <p className="mb-3 text-body-sm font-bold text-fg-muted">{label}</p>
      {sections.length > 0 ? (
        <DocumentBody blocks={sections} headingShift={2} idPrefix={idPrefix} />
      ) : (
        <p className="text-body text-fg-muted">{legalScreenCopy.comparisonEmptyLabel}</p>
      )}
    </div>
  );
}
