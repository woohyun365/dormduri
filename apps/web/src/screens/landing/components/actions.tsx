import type { ReactNode } from 'react';
import { landingCopy } from '../model/landingCopy';

// The landing's two actions. Sign-up keeps one name everywhere; the header passes its short name as
// the one exception (landingCopy.startLabel).

export function SignupLink({
  children = landingCopy.primaryCtaLabel,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href="/signup"
      className={`inline-flex min-h-target-primary items-center justify-center gap-2 rounded-full bg-brand-solid px-5 text-body font-bold text-fg-on-brand depth-glow focus-visible:focus-ring ${className}`}
    >
      {children}
    </a>
  );
}

export function LoginLink({ className = '' }: { className?: string }) {
  return (
    <a
      href="/login"
      className={`inline-flex min-h-target-primary items-center px-2 text-body-sm font-medium underline-offset-4 hover:underline focus-visible:focus-ring ${className}`}
    >
      {landingCopy.loginLabel}
    </a>
  );
}
