import type { ReactNode } from 'react';
import MainRouteShell from './MainRouteShell.client';

export default function MainLayout({ children }: { children: ReactNode }) {
  return <MainRouteShell>{children}</MainRouteShell>;
}
