'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--knu-background-alt)] transition-colors mr-2"
      aria-label="뒤로가기"
    >
      <ChevronLeft className="w-6 h-6 text-[var(--knu-text-primary)]" />
    </button>
  );
}
