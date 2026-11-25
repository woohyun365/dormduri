import type { ReactNode } from 'react';
import { AuthCard } from '@/ui/AuthCard';

/** The sign-in screens in the bordered card with the logo (design guide ④). */
export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return <AuthCard>{children}</AuthCard>;
}
