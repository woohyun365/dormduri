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
  const dialogRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pendingAnchorHrefRef = useRef<string | null>(null);

  const closeMobileMenu = useCallback((restoreFocus = false) => {
    setMobileMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus({ preventScroll: true });
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

    const dialog = dialogRef.current;
    const lockedScrollY = window.scrollY;
    const backgroundElements = [
      ...document.querySelectorAll<HTMLElement>('[data-landing-modal-background]'),
      document.querySelector<HTMLElement>('main'),
      document.querySelector<HTMLElement>('footer'),
    ].filter((element): element is HTMLElement => element !== null && !dialog?.contains(element));
    const previousInertStates = backgroundElements.map((element) => element.inert);
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyWidth = document.body.style.width;
    const previousOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    backgroundElements.forEach((element) => {
      element.inert = true;
    });
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.documentElement.style.overscrollBehavior = 'none';

    const focusableElements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.inert && element.getAttribute('aria-hidden') !== 'true');

    const focusFirstNavigationItem = window.setTimeout(() => {
      const firstNavigationItem = dialog?.querySelector<HTMLElement>('nav a[href]');
      firstNavigationItem?.focus({ preventScroll: true });
    }, 220);

    const handleModalKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMobileMenu(true);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = focusableElements();
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleModalKeyboard);

    return () => {
      window.clearTimeout(focusFirstNavigationItem);
      document.removeEventListener('keydown', handleModalKeyboard);
      backgroundElements.forEach((element, index) => {
        element.inert = previousInertStates[index] ?? false;
      });
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overscrollBehavior = previousOverscrollBehavior;

      if (lockedScrollY > 0) {
        const previousScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, lockedScrollY);
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
      }
    };
  }, [closeMobileMenu, mobileMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) return undefined;

    const pendingAnchorHref = pendingAnchorHrefRef.current;
    if (!pendingAnchorHref) return undefined;
    pendingAnchorHrefRef.current = null;

    const navigateToAnchor = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(pendingAnchorHref);
      if (!target) return;

      window.history.pushState(null, '', pendingAnchorHref);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(navigateToAnchor);
  }, [mobileMenuOpen]);

  return (
    <div
      ref={dialogRef}
      role={mobileMenuOpen ? 'dialog' : undefined}
      aria-modal={mobileMenuOpen ? true : undefined}
      aria-label={mobileMenuOpen ? '랜딩 모바일 메뉴' : undefined}
      className="lg:hidden"
    >
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => {
          if (mobileMenuOpen) {
            closeMobileMenu(true);
          } else {
            setMobileMenuOpen(true);
          }
        }}
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

      <button
        type="button"
        tabIndex={-1}
        aria-label="메뉴 바깥 영역 닫기"
        data-state={mobileMenuOpen ? 'open' : 'closed'}
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        onClick={() => closeMobileMenu(true)}
        className="pointer-events-none fixed inset-x-0 top-16 bottom-0 z-0 bg-slate-950/25 opacity-0 transition-opacity duration-200 ease-out data-[state=open]:pointer-events-auto data-[state=open]:opacity-100 motion-reduce:transition-none"
      />

      <div
        id={MOBILE_MENU_ID}
        data-state={mobileMenuOpen ? 'open' : 'closed'}
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className="pointer-events-none fixed inset-x-0 top-16 z-10 grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-in data-[state=open]:pointer-events-auto data-[state=open]:grid-rows-[1fr] data-[state=open]:ease-out motion-reduce:transition-none"
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
                  onClick={(event) => {
                    event.preventDefault();
                    pendingAnchorHrefRef.current = item.href;
                    closeMobileMenu();
                  }}
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
