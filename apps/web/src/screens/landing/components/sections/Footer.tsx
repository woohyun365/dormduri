import { landingCopy } from '../../model/landingCopy';
import { footerNotice } from '../../model/landingNotices';
import { LANDING_SURFACE_SECTION_IDS } from '../../model/landingPolicyCopy';
import { BrandMark } from '../BrandMark';
import { container } from '../sectionStyles';
import type { LogoTone } from '../sceneArt';

const { footer } = landingCopy;

// Footer: every column's items start on the column's left edge and on the same line under the
// headings, all links in one style; the inquiry address is text, not a link, under its heading once;
// the closing divider spans the content width only.
export function Footer({ logo }: { logo: LogoTone }) {
  const link = 'underline underline-offset-4 focus-visible:focus-ring';
  return (
    <footer
      id={LANDING_SURFACE_SECTION_IDS.footer}
      className="border-t border-stroke-subtle bg-layer-basement text-body-sm"
    >
      <div className={`${container} grid grid-cols-2 gap-8 py-12 md:grid-cols-4`}>
        <div className="col-span-2 md:col-span-4">
          <BrandMark tone={logo} large />
        </div>
        <nav aria-label={footer.serviceLabel} className="flex flex-col gap-3">
          <p className="font-bold">{footer.serviceLabel}</p>
          <a href="/login" className={`self-start ${link}`}>
            {landingCopy.loginLabel}
          </a>
        </nav>
        <div className="flex flex-col gap-3">
          <p className="font-bold">{footer.legalNavLabel}</p>
          <nav aria-label={footer.legalNavLabel} className="flex flex-col items-start gap-4">
            <a href="/terms" className={link}>
              {footer.termsLabel}
            </a>
            <a href="/privacy" className={link}>
              {footer.privacyLabel}
            </a>
          </nav>
        </div>
        <div className="col-span-2 flex flex-col gap-3">
          <p className="font-bold">{footer.inquiryLabel}</p>
          <address className="text-fg-muted not-italic">{footer.inquiryPlaceholder}</address>
        </div>
      </div>
      <div className={container}>
        <p className="border-t border-stroke-subtle py-6 break-keep text-fg-muted">
          {footerNotice.copy}
        </p>
      </div>
    </footer>
  );
}
