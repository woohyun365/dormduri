'use client';

import dynamic from 'next/dynamic';

const HomeDevTool = dynamic(
  () => import('@/main/components/HomeDevTool').then((m) => m.HomeDevTool),
  { ssr: false },
);

export default function SeasonDevToolLoader() {
  return <HomeDevTool />;
}
