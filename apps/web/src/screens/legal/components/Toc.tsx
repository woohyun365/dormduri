'use client';

import type { LegalTocItem } from '../model/legalDocumentModel';
import { legalScreenCopy } from '../model/legalScreenCopy';
import { jumpToHeading } from './jumpToHeading';
import { useVisibleHeadings } from './useVisibleHeadings';

// Table of contents: links to the body headings in source order (G-LU3). Two forms: the side rail on
// wide screens (sticky, marks the articles on screen) and the folded list below lg.

const link =
  'inline-flex min-h-target-min items-center rounded-control py-1 break-keep focus-visible:focus-ring hover:underline underline-offset-4';

function indent(level: LegalTocItem['level']): string {
  if (level === 3) return 'pl-4';
  if (level === 4) return 'pl-8';
  return '';
}

export function TocRail({ items }: { items: LegalTocItem[] }) {
  const { visible, current } = useVisibleHeadings(items.map((item) => item.id));
  return (
    <nav aria-label={legalScreenCopy.tocLabel} className="text-body-sm">
      <p className="mb-2 font-bold">{legalScreenCopy.tocLabel}</p>
      {/* A track on the left; the entries on screen turn it brand and their text dark. Weight never
          changes, so the entries do not shift. */}
      <ol>
        {items.map((item) => {
          const seen = visible.has(item.id);
          return (
            <li
              key={item.id}
              data-in-view={seen || undefined}
              className={`border-l-2 pl-3 motion-safe:transition-colors motion-safe:duration-150 ${
                seen ? 'border-brand-stroke' : 'border-stroke-subtle'
              }`}
            >
              <a
                href={`#${item.id}`}
                onClick={(event) => jumpToHeading(event, item.id)}
                aria-current={item.id === current ? 'location' : undefined}
                className={`${link} ${indent(item.level)} motion-safe:transition-colors motion-safe:duration-150 ${
                  seen ? 'text-fg-neutral' : 'text-fg-muted'
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function TocFolded({ items }: { items: LegalTocItem[] }) {
  return (
    <details className="group border-y border-stroke-subtle">
      <summary className="flex min-h-target-primary cursor-pointer items-center justify-between font-bold focus-visible:focus-ring">
        {legalScreenCopy.tocLabel}
        <span aria-hidden="true" className="text-fg-muted group-open:rotate-180">
          ▾
        </span>
      </summary>
      <nav aria-label={legalScreenCopy.tocLabel} className="pb-4">
        <ol className="text-body-sm">
          {items.map((item) => (
            <li key={item.id} className={indent(item.level)}>
              <a
                href={`#${item.id}`}
                onClick={(event) => jumpToHeading(event, item.id)}
                className={link}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
