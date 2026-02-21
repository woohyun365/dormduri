import Image from 'next/image';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';

interface LegalPageProps {
  title: string;
  content: string;
}

export function LegalPage({ title, content }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <header className="sticky top-0 z-10 bg-white border-b border-[var(--knu-border)]">
        <div className="mx-auto max-w-2xl px-5">
          <div className="flex items-center h-16">
            <BackButton />
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/knu_logo.svg"
                alt="KNU 로고"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-[var(--knu-text-primary)]">KNU 룸메</span>
            </Link>
          </div>
        </div>
      </header>

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
