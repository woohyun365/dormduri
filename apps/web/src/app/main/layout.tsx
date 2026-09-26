import type { ReactNode } from 'react';
import MainRouteShell from './MainRouteShell.client';
import { readMainLayoutBootstrap } from '@/main/server/readMainLayoutBootstrap';

export default async function MainLayout({ children }: { children: ReactNode }) {
  const bootstrap = await readMainLayoutBootstrap();
  return <MainRouteShell bootstrap={bootstrap}>{children}</MainRouteShell>;
}
