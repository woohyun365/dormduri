import type { LegalDocumentTocItem } from '../types/legal-document.types';
import { LEGAL_DOCUMENT_COPY } from '../content/legal-copy';

interface LegalDocumentTocProps {
  items: LegalDocumentTocItem[];
  variant?: 'desktop' | 'mobile';
}

function TocList({ items }: { items: LegalDocumentTocItem[] }) {
  return (
    <ol className="space-y-2 text-sm text-(--knu-text-secondary)">
      {items.map((item) => (
        <li key={item.id} className={item.level > 2 ? 'ml-4' : undefined}>
          <a
            className="rounded-md hover:text-(--knu-primary) focus-visible:outline-2"
            href={`#${item.id}`}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function LegalDocumentToc({ items, variant = 'desktop' }: LegalDocumentTocProps) {
  if (items.length === 0) {
    return null;
  }

  if (variant === 'mobile') {
    return (
      <details className="rounded-2xl border border-(--knu-border) bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-(--knu-text-primary)">
          {LEGAL_DOCUMENT_COPY.mobileTableOfContentsLabel}
        </summary>
        <nav aria-label={LEGAL_DOCUMENT_COPY.mobileTableOfContentsLabel} className="mt-3">
          <TocList items={items} />
        </nav>
      </details>
    );
  }

  return (
    <nav
      aria-label={LEGAL_DOCUMENT_COPY.tableOfContentsLabel}
      className="rounded-2xl border border-(--knu-border) bg-white p-4 shadow-sm"
    >
      <p className="mb-3 text-sm font-semibold text-(--knu-text-primary)">
        {LEGAL_DOCUMENT_COPY.tableOfContentsLabel}
      </p>
      <TocList items={items} />
    </nav>
  );
}
