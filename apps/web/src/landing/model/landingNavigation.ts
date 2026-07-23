import type { Route } from 'next';

export interface LandingAnchorNavigationItem {
  readonly href: `#${string}`;
  readonly label: string;
}

export interface LandingRouteNavigationItem {
  readonly href: Route;
  readonly label: string;
  readonly variant: 'outline' | 'primary';
}

export const landingAnchorNavigationItems = [
  { href: '#how-it-works', label: '이용 흐름' },
  { href: '#features', label: '서비스 소개' },
  { href: '#season', label: '시즌 정책' },
  { href: '#support', label: '이용 도움' },
] as const satisfies readonly LandingAnchorNavigationItem[];

export const landingRouteNavigationItems = [
  { href: '/login', label: '로그인', variant: 'outline' },
  { href: '/signup', label: '회원가입', variant: 'primary' },
] as const satisfies readonly LandingRouteNavigationItem[];

export const landingFocusRingClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)';

export const landingAnchorLinkClass = `${landingFocusRingClass} inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-(--knu-text-secondary) transition-colors hover:text-(--knu-primary)`;

export const landingMobileAnchorLinkClass = `${landingFocusRingClass} flex min-h-12 items-center rounded-xl px-4 text-left font-medium text-(--knu-text-secondary) transition-colors hover:text-(--knu-primary)`;

export const landingNavStyles = {
  outline: {
    desktop: `${landingFocusRingClass} inline-flex h-11 items-center rounded-xl border-2 border-(--knu-border) px-6 font-semibold text-(--knu-text-secondary) transition-colors hover:border-(--knu-primary) hover:text-(--knu-primary)`,
    mobile: `${landingFocusRingClass} flex h-12 items-center justify-center rounded-xl border-2 border-(--knu-border) px-4 text-center font-semibold text-(--knu-text-secondary) transition-colors hover:border-(--knu-primary) hover:text-(--knu-primary)`,
  },
  primary: {
    desktop: `${landingFocusRingClass} inline-flex h-11 items-center rounded-xl bg-(--knu-primary) px-6 font-semibold text-white shadow-sm transition-colors hover:bg-(--knu-primary-hover)`,
    mobile: `${landingFocusRingClass} flex h-12 items-center justify-center rounded-xl bg-(--knu-primary) px-4 font-semibold text-white transition-colors hover:bg-(--knu-primary-hover)`,
  },
} as const;
