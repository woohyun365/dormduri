import { legalShellCopy } from '../../model/legalScreenCopy';

// Shell B's footer: one line with the inquiry address and the independent-service notice.
export function LegalShellFooter() {
  return (
    <footer className="border-t border-stroke-subtle pb-safe-area text-body-sm text-fg-muted print:hidden">
      <div className="mx-auto flex w-full max-w-page flex-wrap gap-x-6 gap-y-1 px-gutter py-6">
        <p>
          {legalShellCopy.inquiryLabel}{' '}
          <span className="break-words">{legalShellCopy.inquiryAddress}</span>
        </p>
        <p className="break-keep">{legalShellCopy.independentNotice}</p>
      </div>
    </footer>
  );
}
