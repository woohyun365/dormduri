import { formatVersionPeriod, type LegalVersionRow } from '../model/legalDocumentModel';
import { legalScreenCopy } from '../model/legalScreenCopy';

// Periods of application and other versions at the document's end, after the article on changes
// (the place Daangn, Kakao, Naver and Toss share; Owner 2026-11-16). Every line shows its status and
// period; the version on screen says so, the others link to their text (G-LU5).
export function VersionHistory({ rows }: { rows: LegalVersionRow[] }) {
  return (
    <section
      aria-labelledby="legal-versions-heading"
      className="mt-16 border-t border-stroke-subtle pt-6"
    >
      <h2 id="legal-versions-heading" className="text-body font-bold">
        {legalScreenCopy.versionsTitle}
      </h2>
      <ul className="mt-3 space-y-2 text-body-sm">
        {rows.map((row) => {
          const label = legalScreenCopy.versionStatusLabel[row.status];
          const period = formatVersionPeriod(row.period);
          return (
            <li key={row.versionKey} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">{label}</span>
              <span className="text-fg-muted">{period}</span>
              {row.viewing ? (
                <span className="text-fg-muted">({legalScreenCopy.viewingVersionLabel})</span>
              ) : (
                <a
                  href={row.href}
                  className="inline-flex min-h-target-min items-center font-medium text-fg-brand underline underline-offset-4 focus-visible:focus-ring"
                  aria-label={`${label} ${period} ${legalScreenCopy.viewVersionLabel}`}
                >
                  {legalScreenCopy.viewVersionLabel}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
