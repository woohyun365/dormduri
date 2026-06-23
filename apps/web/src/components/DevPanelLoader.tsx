'use client';

import dynamic from 'next/dynamic';

const DevPanel = dynamic(() => import('@/main/components/DevPanel').then((m) => m.DevPanel), {
  ssr: false,
});

export default function DevPanelLoader() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <DevPanel />;
}
