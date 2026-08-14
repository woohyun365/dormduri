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
    <header className="sticky top-0 z-50 border-b border-(--knu-border) bg-white/95">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 로고는 랜딩 상태를 초기화하도록 문서 전체를 다시 연다. */}
          <a
            href="/"
            data-landing-modal-background
            className={`${landingFocusRingClass} flex items-center gap-2 rounded-xl`}
          >
            <Image
              src="/knu_logo.svg"
              alt="KNU 룸메 로고"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span className="text-xl font-bold text-(--knu-text-primary)">KNU 룸메</span>
          </a>

          <nav
            data-landing-modal-background
            className="hidden items-center gap-6 lg:flex"
            aria-label="랜딩 주요 섹션"
          >
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
