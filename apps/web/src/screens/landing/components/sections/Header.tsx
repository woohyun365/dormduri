import Link from 'next/link';
import { BrandLogo, type BrandLogoTone } from '@/screens/ui/brand';
import { landingCopy } from '../../model/landingCopy';
import { LoginLink, SignupLink } from '../actions';
import { container } from '../sectionStyles';

// Logo (a link home, back to the top of this page), 로그인 and 시작하기 at every width: no section
// menu (the hero question box leads to the sections).
export function Header({ logo }: { logo: BrandLogoTone }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stroke-subtle bg-layer-basement">
      {/* Below sm the gaps and the pill padding shrink so the logo, 로그인 and 시작하기 fit one line
          at 320px; nowrap keeps a word from breaking in the middle. */}
      <div className={`${container} flex min-h-16 items-center justify-between gap-3 sm:gap-6`}>
        <Link
          href="/"
          className="flex min-h-target-primary shrink-0 items-center rounded-control focus-visible:focus-ring"
        >
          <BrandLogo tone={logo} />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <LoginLink className="whitespace-nowrap" />
          <SignupLink className="whitespace-nowrap max-sm:px-4">
            {landingCopy.startLabel}
          </SignupLink>
        </div>
      </div>
    </header>
  );
}
