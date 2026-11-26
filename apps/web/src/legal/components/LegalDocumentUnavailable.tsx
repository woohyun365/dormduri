import type { Route } from 'next';
import Link from 'next/link';
import { LEGAL_DOCUMENT_COPY } from '../content/legal-copy';

interface LegalDocumentUnavailableProps {
  /** `version-not-found`: a version address the API does not have; otherwise nothing could be read. */
  reason?: 'unavailable' | 'version-not-found';
  /** The route of the version in effect, offered when a version address is not found. */
  currentDocumentHref?: Route;
}

export function LegalDocumentUnavailable({
  reason = 'unavailable',
  currentDocumentHref,
}: LegalDocumentUnavailableProps) {
  const notFound = reason === 'version-not-found';

  return (
    <main className="min-h-screen bg-(--knu-background-alt) px-5 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-(--knu-border) bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-(--knu-primary)">돔두리</p>
        <h1 className="mt-3 text-2xl font-bold text-(--knu-text-primary)">
          {notFound
            ? LEGAL_DOCUMENT_COPY.versionNotFoundTitle
            : LEGAL_DOCUMENT_COPY.unavailableTitle}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-(--knu-text-secondary)">
          {notFound
            ? LEGAL_DOCUMENT_COPY.versionNotFoundDescription
            : LEGAL_DOCUMENT_COPY.unavailableDescription}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {notFound && currentDocumentHref && (
            <Link
              href={currentDocumentHref}
              className="inline-flex rounded-full border border-(--knu-primary) px-5 py-3 text-sm font-semibold text-(--knu-primary)"
            >
              {LEGAL_DOCUMENT_COPY.currentDocumentLinkLabel}
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex rounded-full bg-(--knu-primary) px-5 py-3 text-sm font-semibold text-white"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
