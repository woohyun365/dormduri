'use client';

import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';

interface LegalPageProps {
  title: string;
  content: string;
}

export function LegalPage({ title, content }: LegalPageProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <AuthHeader showBack onBack={() => router.back()} />

      <div className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-6">
          {title}
        </h1>
        <div className="bg-white rounded-2xl shadow-sm border-2 border-[var(--knu-border)] p-6 md:p-8">
          <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
