'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

const MOBILE_MENU_ID = 'landing-mobile-menu';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const ANCHOR_ITEMS: ReadonlyArray<{ href: `#${string}`; targetId: string; label: string }> = [
  { href: '#how-it-works', targetId: 'how-it-works', label: '이용 흐름' },
  { href: '#features', targetId: 'features', label: '서비스 소개' },
  { href: '#season', targetId: 'season', label: '시즌 정책' },
  { href: '#faq', targetId: 'faq', label: 'FAQ' },
];

const NAV_ITEMS: ReadonlyArray<{ href: Route; label: string; variant: 'outline' | 'primary' }> = [
  {
    href: '/login',
    label: '로그인',
    variant: 'outline',
  },
  {
    href: '/signup',
    label: '회원가입',
    variant: 'primary',
  },
];

const focusRingClass =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)';

const anchorLinkClass = `${focusRingClass} inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-(--knu-text-secondary) transition-colors hover:text-(--knu-primary)`;

const mobileAnchorLinkClass = `${focusRingClass} flex min-h-12 items-center rounded-xl px-4 text-left font-medium text-(--knu-text-secondary) transition-colors hover:text-(--knu-primary)`;

const navStyles = {
  outline: {
    desktop: `${focusRingClass} inline-flex h-11 items-center rounded-xl border-2 border-(--knu-border) px-6 font-semibold text-(--knu-text-secondary) transition-all hover:border-(--knu-primary) hover:text-(--knu-primary)`,
    mobile: `${focusRingClass} flex h-12 items-center justify-center rounded-xl border-2 border-(--knu-border) px-4 text-center font-semibold text-(--knu-text-secondary) transition-all hover:border-(--knu-primary) hover:text-(--knu-primary)`,
  },
  primary: {
    desktop: `${focusRingClass} inline-flex h-11 items-center rounded-xl bg-(--knu-primary) px-6 font-semibold text-white shadow-sm transition-all hover:bg-(--knu-primary-hover)`,
    mobile: `${focusRingClass} flex h-12 items-center justify-center rounded-xl bg-(--knu-primary) px-4 font-semibold text-white transition-all hover:bg-(--knu-primary-hover)`,
  },
} as const;

function isPrimaryUnmodifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth';
}

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback((options: { restoreFocus?: boolean } = {}) => {
    setMobileMenuOpen(false);
    if (options.restoreFocus) {
      menuButtonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => {
      if (mq.matches) closeMobileMenu();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [closeMobileMenu]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenuOpen) {
        event.stopPropagation();
        closeMobileMenu({ restoreFocus: true });
      }
    },
    [closeMobileMenu, mobileMenuOpen],
  );

  const handleAnchorClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, item: { href: `#${string}`; targetId: string }) => {
      closeMobileMenu();

      if (!isPrimaryUnmodifiedClick(event)) {
        return;
      }

      const target = document.getElementById(item.targetId);
      if (!target) {
        return;
      }

      event.preventDefault();
      window.history.pushState(null, '', item.href);
      target.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
    },
    [closeMobileMenu],
  );

  return (
    <header
      className="sticky top-0 z-50 border-b border-(--knu-border) bg-white/95 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          <div className="flex items-center">
            <Link href="/" className={`${focusRingClass} flex items-center gap-2 rounded-xl`}>
              <Image
                src="/knu_logo.svg"
                alt="KNU 룸메 로고"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-xl font-bold text-(--knu-text-primary)">KNU 룸메</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="랜딩 주요 섹션">
            <div className="flex items-center gap-4">
              {ANCHOR_ITEMS.map((item) => (
                <a
                  key={item.targetId}
                  href={item.href}
                  onClick={(event) => handleAnchorClick(event, item)}
                  className={anchorLinkClass}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={navStyles[item.variant].desktop}>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className={`${focusRingClass} flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-(--knu-background-alt) lg:hidden`}
            aria-label="메뉴"
            aria-expanded={mobileMenuOpen}
            aria-controls={MOBILE_MENU_ID}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-(--knu-text-primary)" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6 text-(--knu-text-primary)" aria-hidden="true" />
            )}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div id={MOBILE_MENU_ID} className="border-t border-(--knu-border) py-4 lg:hidden">
            <nav className="flex flex-col gap-2" aria-label="랜딩 모바일 내비게이션">
              {ANCHOR_ITEMS.map((item) => (
                <a
                  key={item.targetId}
                  href={item.href}
                  onClick={(event) => handleAnchorClick(event, item)}
                  className={mobileAnchorLinkClass}
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-(--knu-border) pt-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => closeMobileMenu()}
                    className={navStyles[item.variant].mobile}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
