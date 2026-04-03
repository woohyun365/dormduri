'use client';

import dynamic from 'next/dynamic';

const AuthPanel = dynamic(() => import('@/main/components/AuthPanel').then((m) => m.AuthPanel), {
  ssr: false,
});

export default function AuthPanelLoader() {
  return <AuthPanel />;
}
