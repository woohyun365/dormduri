import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface LandingPrimaryCtaLinkProps {
  href: Route;
  children: ReactNode;
}

export function LandingPrimaryCtaLink({ href, children }: LandingPrimaryCtaLinkProps) {
  return (
    <Link
      href={href}
      className="font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 bg-(--knu-primary) hover:bg-(--knu-primary-hover) text-white shadow-sm hover:shadow-md h-14 px-8 text-lg"
    >
      {children}
    </Link>
  );
}
