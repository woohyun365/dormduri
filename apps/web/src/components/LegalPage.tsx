import Image from 'next/image';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';

interface LegalPageProps {
  title: string;
  content: string;
  effectiveDate?: string;
  lastModified?: string;
}

export function LegalPage({ title, content, effectiveDate, lastModified }: LegalPageProps) {
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800">
            본 서비스는 강원대학교와 제휴·인가·보증 관계가 없는 독립 운영 서비스입니다. 서비스에
            대한 책임은 운영자 개인에게 있으며, 강원대학교는 본 서비스의 내용, 운영, 결과에 대해
            어떠한 책임도 지지 않습니다.
          </p>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-4">
          {title}
        </h1>

        {(effectiveDate || lastModified) && (
          <div className="flex gap-4 text-xs text-[var(--knu-text-tertiary)] mb-6">
            {effectiveDate && <span>시행일: {effectiveDate}</span>}
            {lastModified && <span>최종 수정일: {lastModified}</span>}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border-2 border-[var(--knu-border)] p-6 md:p-8">
          <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
