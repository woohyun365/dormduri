'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  landingFocusRingClass,
  landingMobileAnchorLinkClass,
  landingNavStyles,
  type LandingAnchorNavigationItem,
  type LandingRouteNavigationItem,
} from '../model/landingNavigation';

const MOBILE_MENU_ID = 'landing-mobile-menu';

interface LandingMobileNavigationProps {
  readonly anchorItems: readonly LandingAnchorNavigationItem[];
  readonly routeItems: readonly LandingRouteNavigationItem[];
}

export function LandingMobileNavigation({ anchorItems, routeItems }: LandingMobileNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback((restoreFocus = false) => {
    setMobileMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const closeAtDesktop = () => {
      if (mq.matches) closeMobileMenu();
    };
    mq.addEventListener('change', closeAtDesktop);
    return () => mq.removeEventListener('change', closeAtDesktop);
  }, [closeMobileMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeMobileMenu(true);
    };
    document.addEventListener('keydown', closeWithEscape);
    return () => document.removeEventListener('keydown', closeWithEscape);
  }, [closeMobileMenu, mobileMenuOpen]);

  return (
    <div className="lg:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMobileMenuOpen((current) => !current)}
        className={`${landingFocusRingClass} flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-(--knu-background-alt)`}
        aria-label="메뉴"
        aria-expanded={mobileMenuOpen}
        aria-controls={MOBILE_MENU_ID}
      >
        <span className="relative size-6" aria-hidden="true">
          <Menu
            className={`absolute inset-0 size-6 text-(--knu-text-primary) transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${mobileMenuOpen ? '-rotate-45 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
          />
          <X
            className={`absolute inset-0 size-6 text-(--knu-text-primary) transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${mobileMenuOpen ? 'rotate-0 scale-100 opacity-100' : 'rotate-45 scale-75 opacity-0'}`}
          />
        </span>
      </button>

      <div
        id={MOBILE_MENU_ID}
        data-state={mobileMenuOpen ? 'open' : 'closed'}
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className="pointer-events-none absolute inset-x-0 top-full grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-in data-[state=open]:pointer-events-auto data-[state=open]:grid-rows-[1fr] data-[state=open]:ease-out motion-reduce:transition-none"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-y border-(--knu-border) bg-white px-5 py-4 shadow-sm">
            <nav
              className="mx-auto flex max-w-7xl flex-col gap-2"
              aria-label="랜딩 모바일 내비게이션"
            >
              {anchorItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => closeMobileMenu()}
                  className={landingMobileAnchorLinkClass}
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-(--knu-border) pt-2">
                {routeItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => closeMobileMenu()}
                    className={landingNavStyles[item.variant].mobile}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
