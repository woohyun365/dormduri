import type { LegalDocumentView } from '../model/legalDocumentModel';
import { legalScreenCopy } from '../model/legalScreenCopy';
import { DocumentActions } from './DocumentActions';
import { HeadingLink } from './HeadingLink';
import { Notice } from './Notice';

const comparisonLink =
  'font-medium text-fg-brand underline underline-offset-4 focus-visible:focus-ring';

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
        <Notice label={legalScreenCopy.changeSummaryLabel}>
          {view.changeSummary}
          {link && <> {link}</>}
        </Notice>
      ) : (
        link && <p className="text-body-sm">{link}</p>
      )}
      {view.summaryItems.length > 0 && (
        <section aria-labelledby="legal-summary-heading">
          <h2 id="legal-summary-heading" className="text-body font-bold">
            {legalScreenCopy.summaryLabel}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-body">
            {view.summaryItems.map((item) => (
              <li key={item} className="break-keep wrap-anywhere">
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
