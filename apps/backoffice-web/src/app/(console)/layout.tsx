import type { ReactNode } from 'react';
import { ConsoleShell } from '@/screens/console/ConsoleShell';
import { requireFullSession } from '@/server/session';

export default async function ConsoleLayout({ children }: { readonly children: ReactNode }) {
  return <ConsoleShell active={await requireFullSession()}>{children}</ConsoleShell>;
}
