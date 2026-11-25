import type { ReactNode } from 'react';
import { BrandLogo } from './brand/BrandLogo';

/**
 * The bordered card with the logo on a light page: the sign-in screens (the (auth) route group) and the not-found and
 * error pages outside the console. The card is the page's main.
 */
export function AuthCard({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-layer-muted px-6 py-12">
      <main className="flex w-full max-w-narrow flex-col gap-6 rounded-card border border-stroke-subtle bg-layer-default p-8">
        <BrandLogo />
        {children}
      </main>
    </div>
  );
}
