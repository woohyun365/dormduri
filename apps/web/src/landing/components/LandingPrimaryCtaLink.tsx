import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface LandingPrimaryCtaLinkProps {
  href: Route;
  children: ReactNode;
  size?: 'default' | 'hero';
}

const sizeClass = {
  default: 'h-14 px-8 text-lg',
  hero: 'h-12 px-5 text-base sm:h-14 sm:px-7 sm:text-lg',
} as const;

export function LandingPrimaryCtaLink({
  href,
  children,
  size = 'default',
}: LandingPrimaryCtaLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-(--knu-primary) font-semibold text-white shadow-sm transition-colors hover:bg-(--knu-primary-hover) hover:shadow-md ${sizeClass[size]}`}
    >
      {children}
    </Link>
  );
}
