import type { ReactNode } from 'react';
import {
  MAJOR_CHANGE_LABEL,
  type LegalChangeSummaryView,
  type LegalDocumentView,
} from '../model/legalDocumentModel';
import { legalScreenCopy } from '../model/legalScreenCopy';
import { DocumentActions } from './DocumentActions';
import { HeadingLink } from './HeadingLink';
import { Notice } from './Notice';

const comparisonLink =
  'whitespace-nowrap font-medium text-fg-brand underline underline-offset-4 focus-visible:focus-ring';

const MAJOR_CHANGES_ID = 'legal-major-changes';

// One title per block: with major changes the words before them stay a plain line and the major
// changes are a list under their own label; without them the change summary label (LB-R10) takes its
// own line above the text. Every sentence starts at the left; the link to the comparison table ends the
// block (Owner 2026-11-26).
function ChangeSummary({ summary, link }: { summary: LegalChangeSummaryView; link: ReactNode }) {
  return (
    <Notice>
      <div className="space-y-2">
        {summary.majorChanges.length > 0 ? (
          <>
            {summary.summary && <p>{summary.summary}</p>}
            <div>
              <p id={MAJOR_CHANGES_ID} className="font-bold">
                {MAJOR_CHANGE_LABEL}
              </p>
              <ul aria-labelledby={MAJOR_CHANGES_ID} className="mt-1 list-disc space-y-1 pl-6">
                {summary.majorChanges.map((change, index) => (
                  // A summary may repeat a sentence; its place in the text keeps each item apart.
                  <li key={`${index}:${change}`}>{change}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div>
            <p className="font-bold">{legalScreenCopy.changeSummaryLabel}</p>
            <p className="mt-1">{summary.summary}</p>
          </div>
        )}
        {link && <p>{link}</p>}
      </div>
    </Notice>
  );
}

// Title → introduction → dates and change summary → summary → actions (G-LU2, G-LU3, G-LU5). The one
// h1 is the document's own title. With a comparison table on the page, the change summary links to it
// ('달라진 조항 보기', D-LU18).
export function DocumentIntro({
  view,
  intro,
  comparisonTargetId,
}: {
  view: LegalDocumentView;
  intro: string;
  comparisonTargetId?: string;
}) {
  const link = comparisonTargetId && (
    <HeadingLink targetId={comparisonTargetId} className={comparisonLink}>
      {legalScreenCopy.comparisonLinkLabel}
    </HeadingLink>
  );
  return (
    <header className="space-y-5">
      <h1 className="text-title-1 font-bold text-balance break-keep sm:text-display-3">
        {view.title}
      </h1>
      <p className="text-body text-fg-muted break-keep">{intro}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-body-sm">
        <div className="flex gap-2">
          <dt className="font-bold">{legalScreenCopy.effectiveLabel}</dt>
          <dd className="text-fg-muted">{view.effectiveDate}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-bold">{legalScreenCopy.lastModifiedLabel}</dt>
          <dd className="text-fg-muted">{view.lastModifiedDate}</dd>
        </div>
      </dl>
      {view.changeSummary ? (
        <ChangeSummary summary={view.changeSummary} link={link} />
      ) : (
        link && <p className="text-body-sm">{link}</p>
      )}
      {view.summaryItems.length > 0 && (
        <section aria-labelledby="legal-summary-heading">
          <h2 id="legal-summary-heading" className="text-body font-bold">
            {legalScreenCopy.summaryLabel}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-body">
            {view.summaryItems.map((item, index) => (
              <li key={`${index}:${item}`} className="break-keep wrap-anywhere">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      <DocumentActions />
    </header>
  );
}
