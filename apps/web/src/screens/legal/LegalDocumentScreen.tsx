import Link from 'next/link';
import type { LegalDocumentPageResponse, LegalVersionComparison } from '@repo/shared/legal';
import { controlButton, quietButton } from '@/screens/ui/controls/buttons';
import {
  isPublicLegalDocumentKind,
  legalDocumentPaths,
  type PublicLegalDocumentKind,
} from '@/screens/ui/model/legalAddress';
import { formatLegalDate } from '@/screens/ui/model/legalDates';
import {
  formatLegalCheckedAt,
  toLegalComparisonView,
  toLegalDocumentView,
  toLegalPageNotices,
  toLegalVersionRows,
  type LegalPageNotice,
} from './model/legalDocumentModel';
import {
  legalDocumentIntros,
  legalDocumentNames,
  legalScreenCopy,
  legalShellCopy,
} from './model/legalScreenCopy';
import { DocumentBody } from './components/DocumentBody';
import { DocumentIntro } from './components/DocumentIntro';
import { InitialHashJump } from './components/InitialHashJump';
import { LegalFrame } from './components/LegalFrame';
import { Notice } from './components/Notice';
import { TocFolded, TocRail } from './components/Toc';
import { VersionComparison, legalComparisonHeadingId } from './components/VersionComparison';
import { VersionHistory } from './components/VersionHistory';
import { LegalShellFooter } from './components/shell/LegalShellFooter';
import { LegalShellHeader } from './components/shell/LegalShellHeader';

/** Where the shown version came from: the public reading API, or the copy this Web server last kept. */
export type LegalDocumentSource =
  { readonly kind: 'published' } | { readonly kind: 'last-success'; readonly checkedAt: string };

export type LegalDocumentScreenProps = {
  /** The `/page` answer for the address: the version on screen, every version and the announced one. */
  page: LegalDocumentPageResponse;
  source: LegalDocumentSource;
  /** The `/comparison` answer for the version on screen; null when it cannot be read. */
  comparison: LegalVersionComparison | null;
};

// A notice's link never breaks inside. After the one-sentence new-version notice it takes its own line
// below md and follows the sentence from md; a version notice starts each sentence on its own line after
// the label and puts its link on the next one (Owner LU4 Human Feedback 2).
const linkLook =
  'block w-fit whitespace-nowrap font-medium text-fg-brand underline underline-offset-4 focus-visible:focus-ring';
const noticeLink = `${linkLook} mt-1 md:mt-0 md:ml-2 md:inline`;
const versionNoticeLink = `${linkLook} mt-1`;

function PageNotice({ notice, name }: { notice: LegalPageNotice; name: string }) {
  if (notice.kind === 'scheduled') {
    return (
      <Notice label={legalScreenCopy.scheduledLabel} role="note">
        {`${legalScreenCopy.scheduledNotice(formatLegalDate(notice.appliesFrom), name)} `}
        <a href={notice.href} className={noticeLink}>
          {legalScreenCopy.scheduledLinkLabel}
        </a>
      </Notice>
    );
  }
  const from = formatLegalDate(notice.period.from);
  const [first, ...rest] =
    notice.status === 'scheduled'
      ? legalScreenCopy.viewingScheduledNotice(from)
      : legalScreenCopy.viewingPreviousNotice(
          from,
          formatLegalDate(notice.period.until ?? notice.period.from),
        );
  return (
    <Notice label={legalScreenCopy.versionStatusLabel[notice.status]} role="note">
      <span>{first}</span>
      {rest.map((sentence) => (
        <span key={sentence} className="block">
          {sentence}
        </span>
      ))}
      <a href={notice.currentHref} className={versionNoticeLink}>
        {legalScreenCopy.viewCurrentVersionLabel}
      </a>
    </Notice>
  );
}

// The /privacy and /terms page for one version of the document (D-LU10). Order: notices → title and
// introduction → contents → body → the articles changed from the version before → the periods and the
// other versions. The screen draws what the contract answers and works out no version itself (G-LU5).
export function LegalDocumentScreen({ page, source, comparison }: LegalDocumentScreenProps) {
  const kind = page.kind;
  if (!isPublicLegalDocumentKind(kind)) {
    // The routes ask only for the two public documents; any other kind is a contract mismatch.
    throw new Error(`The legal document screen draws the public documents only, not ${kind}.`);
  }
  const view = toLegalDocumentView(page.viewing);
  const name = legalDocumentNames[kind];
  const notices = toLegalPageNotices(kind, page);
  const rows = toLegalVersionRows(kind, page);
  const comparisonView = toLegalComparisonView(comparison);
  const hasNotice = notices.length > 0 || source.kind === 'last-success';

  // Reading order is title → introduction → table of contents → body (G-LU3, 1.3.2). On lg the rail
  // sits beside the text by grid placement, not by moving it after the body; below lg the contents
  // fold under the introduction.
  return (
    <LegalFrame className="flex min-h-screen flex-col">
      {/* Not user copy: the Web deploy smoke (infra/deploy/user/ssm/deploy.sh) keeps a new Web only when
          both documents are marked published. The message screens carry no mark. */}
      <span hidden data-dormduri-legal-source={source.kind} />
      <LegalShellHeader current={kind} />
      <main className="mx-auto w-full max-w-page flex-1 px-gutter py-10 lg:py-14">
        <article className="min-w-0 lg:grid lg:grid-cols-12 lg:gap-x-12">
          <div className="space-y-8 lg:col-span-8 lg:row-start-1">
            {hasNotice && (
              <div className="space-y-3">
                {notices.map((notice) => (
                  <PageNotice key={notice.kind} notice={notice} name={name} />
                ))}
                {source.kind === 'last-success' && (
                  <Notice label={legalScreenCopy.noticeLabel.INFO} role="status">
                    {legalScreenCopy.lastSuccessNotice}
                    <span className="mt-1 block">
                      <strong className="mr-2 font-bold">{legalScreenCopy.checkedAtLabel}</strong>
                      {formatLegalCheckedAt(source.checkedAt)}
                    </span>
                  </Notice>
                )}
              </div>
            )}
            <DocumentIntro
              view={view}
              intro={legalDocumentIntros[kind]}
              comparisonTargetId={
                comparisonView.state === 'table' ? legalComparisonHeadingId : undefined
              }
            />
          </div>
          <div className="mt-8 lg:hidden print:hidden">
            <TocFolded items={view.toc} />
          </div>
          <div className="hidden lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:block print:hidden">
            <div className="sticky top-24">
              <TocRail items={view.toc} />
            </div>
          </div>
          <div className="mt-12 lg:col-span-8 lg:row-start-2">
            <DocumentBody blocks={view.blocks} />
            <VersionComparison view={comparisonView} />
            {rows.length > 0 && <VersionHistory rows={rows} />}
          </div>
        </article>
      </main>
      <LegalShellFooter />
      <InitialHashJump />
    </LegalFrame>
  );
}

// A page with no document: the same header keeps the other document and home in reach; the message
// names the document, says what to do now and where to report it, and the two actions sit right under
// it. Never a blank page (G-LU7).
function LegalMessageScreen({
  kind,
  title,
  description,
  action,
  contactLead,
}: {
  kind: PublicLegalDocumentKind;
  title: string;
  description: string;
  action: { href: string; label: string };
  contactLead: string;
}) {
  return (
    <LegalFrame className="flex min-h-screen flex-col">
      <LegalShellHeader current={kind} />
      <main className="mx-auto w-full max-w-reading flex-1 px-gutter py-16 lg:py-24">
        <h1 className="text-title-1 font-bold text-balance break-keep">{title}</h1>
        <p className="mt-4 text-body text-fg-muted break-keep">{description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* A plain link: the document page asks the server for the whole page again. */}
          <a href={action.href} className={controlButton}>
            {action.label}
          </a>
          <Link href="/" className={quietButton}>
            {legalScreenCopy.homeActionLabel}
          </Link>
        </div>
        <p className="mt-12 border-t border-stroke-subtle pt-6 text-body-sm text-fg-muted break-keep">
          {contactLead}{' '}
          <span className="font-medium break-words text-fg-neutral">
            {legalShellCopy.inquiryAddress}
          </span>
        </p>
      </main>
      <LegalShellFooter />
    </LegalFrame>
  );
}

// The document could not be read and no copy is at hand (G-LU7).
export function LegalUnavailableScreen({ kind }: { kind: PublicLegalDocumentKind }) {
  return (
    <LegalMessageScreen
      kind={kind}
      title={`${legalDocumentNames[kind]}${legalScreenCopy.unavailableTitleSuffix}`}
      description={legalScreenCopy.unavailableDescription}
      action={{ href: legalDocumentPaths[kind], label: legalScreenCopy.unavailableRetryLabel }}
      contactLead={legalScreenCopy.contactLead}
    />
  );
}

// A version address with no such version: the route answers 404 and its not-found file draws this
// (G-LU7, D-LU18).
export function LegalVersionNotFoundScreen({ kind }: { kind: PublicLegalDocumentKind }) {
  return (
    <LegalMessageScreen
      kind={kind}
      title={`${legalDocumentNames[kind]}${legalScreenCopy.versionNotFoundTitleSuffix}`}
      description={legalScreenCopy.versionNotFoundDescription}
      action={{ href: legalDocumentPaths[kind], label: legalScreenCopy.viewCurrentVersionLabel }}
      contactLead={legalScreenCopy.versionNotFoundContactLead}
    />
  );
}
