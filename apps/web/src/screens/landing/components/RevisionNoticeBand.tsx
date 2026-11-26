import { legalVersionHref } from '@/screens/ui/model/legalAddress';
import { formatLegalDate } from '@/screens/ui/model/legalDates';
import { landingCopy } from '../model/landingCopy';
import type { LandingRevisionLine } from '../model/landingRevisionNotices';
import { container } from './sectionStyles';

const { footer, revisionNotice } = landingCopy;

// The document names are the footer link names; the privacy line names the policy by law and its link
// is bold, as in the footer (docs/policies/legal-basis.md LB-R1).
const names = {
  PRIVACY_POLICY: footer.privacyLabel,
  TERMS_OF_SERVICE: footer.termsLabel,
} as const satisfies Record<LandingRevisionLine['kind'], string>;

// The revision line above the sticky header (D-LU17, D-LU18): one full-width band, a line per public
// document with a version announced and not yet in force. It scrolls away; the header stays stuck.
// The links are plain anchors: the legal page is a new document, as from the footer. Below md the link
// takes its own line; from md it follows the sentence with a gap. It never breaks inside (Owner
// 2026-11-26).
export function RevisionNoticeBand({ lines }: { lines: readonly LandingRevisionLine[] }) {
  if (lines.length === 0) return null;
  return (
    <aside
      aria-label={revisionNotice.regionLabel}
      className="border-b border-stroke-subtle bg-layer-default text-body-sm"
    >
      <div className={`${container} flex flex-col gap-2 py-2 md:gap-1`}>
        {lines.map((line) => {
          const name = names[line.kind];
          return (
            <p
              key={line.kind}
              className="flex flex-col items-start break-keep md:flex-row md:flex-wrap md:items-baseline md:gap-x-3"
            >
              <span>{revisionNotice.line(formatLegalDate(line.appliesFrom), name)}</span>{' '}
              <a
                href={legalVersionHref(line.kind, {
                  versionKey: line.versionKey,
                  status: 'scheduled',
                })}
                className={`whitespace-nowrap underline underline-offset-4 focus-visible:focus-ring ${
                  line.kind === 'PRIVACY_POLICY' ? 'font-bold' : 'font-medium'
                }`}
              >
                {revisionNotice.linkLabel(name)}
              </a>
            </p>
          );
        })}
      </div>
    </aside>
  );
}
