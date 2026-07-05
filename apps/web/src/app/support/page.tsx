import type { Metadata } from 'next';
import { Suspense } from 'react';
import SupportPageClient from '@/support/SupportPageClient';

export const metadata: Metadata = {
  title: '문의하기',
  description: 'KNU 룸메 고객센터와 문의 내역',
};

function SupportPageFallback() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-12" aria-label="문의하기 로딩 중">
      <div className="h-40 animate-pulse rounded-3xl bg-white" />
    </main>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportPageFallback />}>
      <SupportPageClient />
    </Suspense>
  );
}
