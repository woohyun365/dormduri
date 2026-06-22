import Link from 'next/link';
import { LEGAL_DOCUMENT_COPY, LEGAL_DOCUMENT_ROUTE_LABELS } from '../content/legal-copy';
import type { LegalDocumentSource, LegalDocumentViewModel } from '../types/legal-document.types';
import { LegalDocumentSections } from './LegalDocumentSections';
import { LegalDocumentToc } from './LegalDocumentToc';

interface LegalDocumentLayoutProps {
  document: LegalDocumentViewModel;
  source: LegalDocumentSource;
}

export function LegalDocumentLayout({ document, source }: LegalDocumentLayoutProps) {
  const routeLabel = LEGAL_DOCUMENT_ROUTE_LABELS[document.kind];

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <header className="sticky top-0 z-10 border-b border-(--knu-border) bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link
            href="/"
            className="text-base font-bold text-(--knu-text-primary)"
            aria-label={LEGAL_DOCUMENT_COPY.homeLinkLabel}
          >
            KNU 룸메
          </Link>
          <Link href="/" className="text-sm font-medium text-(--knu-primary)">
            홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-14">
        <article className="min-w-0 space-y-6">
          {source === 'fallback' && (
            <div
              role="status"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            >
              {LEGAL_DOCUMENT_COPY.fallbackNotice}
            </div>
          )}

          <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm md:p-8">
            <p className="text-sm font-semibold text-(--knu-primary)">{routeLabel.title}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-(--knu-text-primary) md:text-4xl">
              {document.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-(--knu-text-secondary) md:text-base">
              {routeLabel.description}
            </p>

            {document.summaryItems.length > 0 && (
              <section
                aria-labelledby="legal-summary-heading"
                className="mt-6 rounded-2xl bg-(--knu-background-alt) p-4"
              >
                <h2
                  id="legal-summary-heading"
                  className="text-sm font-semibold text-(--knu-text-primary)"
                >
                  {LEGAL_DOCUMENT_COPY.summaryLabel}
                </h2>
                <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-(--knu-text-secondary)">
                  {document.summaryItems.map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <dl className="mt-6 grid gap-3 text-sm text-(--knu-text-secondary) sm:grid-cols-3">
              <div>
                <dt className="font-semibold text-(--knu-text-primary)">
                  {LEGAL_DOCUMENT_COPY.metadataVersionLabel}
                </dt>
                <dd className="mt-1">{document.version}</dd>
              </div>
              <div>
                <dt className="font-semibold text-(--knu-text-primary)">
                  {LEGAL_DOCUMENT_COPY.metadataEffectiveLabel}
                </dt>
                <dd className="mt-1">{document.effectiveDateLabel}</dd>
              </div>
              <div>
                <dt className="font-semibold text-(--knu-text-primary)">
                  {LEGAL_DOCUMENT_COPY.metadataUpdatedLabel}
                </dt>
                <dd className="mt-1">{document.lastModifiedDateLabel}</dd>
              </div>
            </dl>

            {document.changeSummary && (
              <p className="mt-6 rounded-2xl border border-(--knu-border) p-4 text-sm leading-6 text-(--knu-text-secondary)">
                <strong className="text-(--knu-text-primary)">
                  {LEGAL_DOCUMENT_COPY.changeSummaryLabel}:{' '}
                </strong>
                {document.changeSummary}
              </p>
            )}
          </section>

          <section className="space-y-6 rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm md:p-8">
            <LegalDocumentSections sections={document.sections} />
          </section>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LegalDocumentToc items={document.tocItems} />
        </aside>
      </main>
    </div>
  );
}
