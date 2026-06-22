import type { LegalDocumentTocItem } from '../types/legal-document.types';
import { LEGAL_DOCUMENT_COPY } from '../content/legal-copy';

interface LegalDocumentTocProps {
  items: LegalDocumentTocItem[];
}

export function LegalDocumentToc({ items }: LegalDocumentTocProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={LEGAL_DOCUMENT_COPY.tableOfContentsLabel}
      className="rounded-2xl border border-(--knu-border) bg-white p-4 shadow-sm"
    >
      <p className="mb-3 text-sm font-semibold text-(--knu-text-primary)">
        {LEGAL_DOCUMENT_COPY.tableOfContentsLabel}
      </p>
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
    </nav>
  );
}
