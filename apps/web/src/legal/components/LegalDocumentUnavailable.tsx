import Link from 'next/link';
import { LEGAL_DOCUMENT_COPY } from '../content/legal-copy';

export function LegalDocumentUnavailable() {
  return (
    <main className="min-h-screen bg-(--knu-background-alt) px-5 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-(--knu-border) bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-(--knu-primary)">KNU 룸메</p>
        <h1 className="mt-3 text-2xl font-bold text-(--knu-text-primary)">
          {LEGAL_DOCUMENT_COPY.unavailableTitle}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-(--knu-text-secondary)">
          {LEGAL_DOCUMENT_COPY.unavailableDescription}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-(--knu-primary) px-5 py-3 text-sm font-semibold text-white"
        >
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
