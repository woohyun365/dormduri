import Link from 'next/link';
import { BrandLogo } from '@/screens/ui/brand';
import { BackButton } from '@/screens/ui/controls';
import { legalDocumentPaths, type PublicLegalDocumentKind } from '@/screens/ui/model/legalAddress';
import { legalDocumentNames, legalScreenCopy } from '../../model/legalScreenCopy';

// '이전 화면으로' treats both documents as one place: after switching between them, opening another
// version or reopening one, it goes to the page before the Legal pages, or home (LU2 Q29, LU3 Q9).
const legalPlacePaths: readonly string[] = Object.values(legalDocumentPaths);

const documentOrder = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
] as const satisfies PublicLegalDocumentKind[];

// Shell B (legal only): logo home, the switch between the two documents, back. No sign-up call on a
// document page. The privacy policy link is bolder than the terms link (G-LU11). It sticks from lg;
// below lg it scrolls away so the document gets the small screen.
export function LegalShellHeader({ current }: { current: PublicLegalDocumentKind }) {
  return (
    <header className="border-b border-stroke-subtle bg-layer-default lg:sticky lg:top-0 lg:z-20 print:hidden">
      <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-x-4 px-gutter py-2">
        <Link
          href="/"
          aria-label={legalScreenCopy.homeLabel}
          className="flex min-h-target-primary shrink-0 items-center rounded-control focus-visible:focus-ring"
        >
          <BrandLogo />
        </Link>
        <BackButton
          label={legalScreenCopy.backLabel}
          samePlacePaths={legalPlacePaths}
          className="sm:order-last"
        />
        <nav
          aria-label={legalScreenCopy.documentNavLabel}
          className="order-last flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1 sm:justify-end"
        >
          {documentOrder.map((kind) => {
            const isCurrent = kind === current;
            return (
              // The two documents switch like tabs: the history entry is replaced, so '이전 화면으로'
              // and the browser's back button return to the page the reader came from (Owner 2026-11-17).
              <Link
                key={kind}
                href={legalDocumentPaths[kind]}
                replace
                aria-current={isCurrent ? 'page' : undefined}
                className={`inline-flex min-h-target-primary items-center rounded-control px-3 text-body-sm underline-offset-4 hover:underline focus-visible:focus-ring ${
                  kind === 'PRIVACY_POLICY' ? 'font-bold' : 'font-medium'
                } ${isCurrent ? 'bg-brand-weak text-fg-brand' : ''}`}
              >
                {legalDocumentNames[kind]}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
