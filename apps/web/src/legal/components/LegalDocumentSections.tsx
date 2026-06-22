import type { ReactNode } from 'react';
import type { LegalDocumentViewSection } from '../types/legal-document.types';

function isArticleHeading(text: string): boolean {
  return /^제\d+조\(.+\)$/.test(text);
}

function getHeadingClassName(level: 2 | 3 | 4, text: string): string {
  if (level === 3) {
    return 'scroll-mt-24 pt-2 text-lg font-semibold text-(--knu-text-primary) md:text-xl';
  }

  if (level === 4) {
    return 'scroll-mt-24 pt-1 text-base font-semibold text-(--knu-text-primary)';
  }

  const articleClassName = isArticleHeading(text) ? 'border-t border-(--knu-border) pt-5 ' : '';

  return `${articleClassName}scroll-mt-24 border-l-4 border-(--knu-primary) pl-3 text-xl font-bold text-(--knu-text-primary) md:text-2xl`;
}

function renderHeading(section: Extract<LegalDocumentViewSection, { type: 'heading' }>): ReactNode {
  const className = getHeadingClassName(section.level, section.text);

  if (section.level === 3) {
    return (
      <h3 id={section.id} className={className}>
        {section.text}
      </h3>
    );
  }

  if (section.level === 4) {
    return (
      <h4 id={section.id} className={className}>
        {section.text}
      </h4>
    );
  }

  return (
    <h2 id={section.id} className={className}>
      {section.text}
    </h2>
  );
}

function renderSection(section: LegalDocumentViewSection, index: number): ReactNode {
  switch (section.type) {
    case 'heading':
      return renderHeading(section);
    case 'paragraph':
      return (
        <p className="text-sm leading-7 text-(--knu-text-secondary) md:text-base md:leading-8">
          {section.text}
        </p>
      );
    case 'list': {
      const ListTag = section.ordered ? 'ol' : 'ul';
      return (
        <ListTag className="space-y-2 pl-5 text-sm leading-7 text-(--knu-text-secondary) md:text-base md:leading-8">
          {section.items.map((item) => (
            <li key={item} className={section.ordered ? 'list-decimal' : 'list-disc'}>
              {item}
            </li>
          ))}
        </ListTag>
      );
    }
    case 'table':
      return (
        <div className="overflow-x-auto rounded-2xl border border-(--knu-border)">
          <table className="min-w-full divide-y divide-(--knu-border) text-left text-sm">
            {section.caption && (
              <caption className="bg-(--knu-background-alt) px-4 py-3 text-left font-semibold text-(--knu-text-primary)">
                {section.caption}
              </caption>
            )}
            <thead className="bg-(--knu-background-alt)">
              <tr>
                {section.headers.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-4 py-3 font-semibold text-(--knu-text-primary)"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--knu-border) bg-white">
              {section.rows.map((row, rowIndex) => (
                <tr key={`${index}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${index}-${rowIndex}-${cellIndex}`}
                      className="px-4 py-3 text-(--knu-text-secondary)"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout':
      return (
        <div
          className={
            section.tone === 'WARNING'
              ? 'rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900'
              : 'rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-900'
          }
        >
          {section.text}
        </div>
      );
    default:
      return null;
  }
}

export function LegalDocumentSections({ sections }: { sections: LegalDocumentViewSection[] }) {
  return (
    <>
      {sections.map((section, index) => (
        <div
          key={section.type === 'heading' ? section.id : `${section.type}-${index}`}
          className="space-y-3"
        >
          {renderSection(section, index)}
        </div>
      ))}
    </>
  );
}
