import Image from 'next/image';
import Link from 'next/link';
import {
  landingAnchorLinkClass,
  landingAnchorNavigationItems,
  landingFocusRingClass,
  landingNavStyles,
  landingRouteNavigationItems,
} from '../model/landingNavigation';
import { LandingMobileNavigation } from './LandingMobileNavigation.client';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-(--knu-border) bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          <Link href="/" className={`${landingFocusRingClass} flex items-center gap-2 rounded-xl`}>
            <Image
              src="/knu_logo.svg"
              alt="KNU 룸메 로고"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span className="text-xl font-bold text-(--knu-text-primary)">KNU 룸메</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="랜딩 주요 섹션">
            <div className="flex items-center gap-4">
              {landingAnchorNavigationItems.map((item) => (
                <a key={item.href} href={item.href} className={landingAnchorLinkClass}>
                  {item.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {landingRouteNavigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={landingNavStyles[item.variant].desktop}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <LandingMobileNavigation
            anchorItems={landingAnchorNavigationItems}
            routeItems={landingRouteNavigationItems}
          />
        </div>
      </div>
    </header>
  );
}
