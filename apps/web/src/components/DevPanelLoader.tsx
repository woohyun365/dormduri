'use client';

import dynamic from 'next/dynamic';

const DevPanel = dynamic(() => import('@/main/components/DevPanel').then((m) => m.DevPanel), {
  ssr: false,
});

export default function DevPanelLoader() {
  return <DevPanel />;
}
