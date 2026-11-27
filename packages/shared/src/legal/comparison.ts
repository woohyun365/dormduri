import type {
  LegalArticleComparison,
  LegalDocumentSection,
  LegalArticleChange,
} from './contract.js';
import { canonicalJson } from './digest.js';

interface Article {
  readonly key: string;
  readonly heading: string | null;
  readonly sections: LegalDocumentSection[];
}

// "제3조", "제3조의2" and spacing variants name the same article even when the title after it changes.
const ARTICLE_NUMBER = /^제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/u;

function articleKey(heading: string): string {
  const text = heading.trim();
  const match = ARTICLE_NUMBER.exec(text);
  if (!match) {
    return text;
  }
  return `제${match[1]}조${match[2] ? `의${match[2]}` : ''}`;
}

/** Level 2 headings start articles; sections before the first one form a heading-less preamble. */
function splitArticles(sections: readonly LegalDocumentSection[]): Article[] {
  const articles: Array<{ key: string; heading: string | null; sections: LegalDocumentSection[] }> =
    [];
  for (const section of sections) {
    if (section.type === 'heading' && section.level === 2) {
      articles.push({ key: articleKey(section.text), heading: section.text, sections: [section] });
      continue;
    }
    let current = articles.at(-1);
    if (!current) {
      current = { key: '', heading: null, sections: [] };
      articles.push(current);
    }
    current.sections.push(section);
  }
  return articles;
}

function entry(
  change: LegalArticleChange,
  heading: string | null,
  before: LegalDocumentSection[],
  after: LegalDocumentSection[],
): LegalArticleComparison {
  return { heading, change, before, after };
}

/**
 * The article comparison table between a version and the one before it. Articles pair by their
 * "제N조" prefix (else the whole heading text); output follows the new order, and a removed article
 * appears after the last kept article that preceded it. A first version (no previous) has no rows.
 * The public API and the backoffice preview both use this one calculation.
 */
export function compareLegalSections(
  before: readonly LegalDocumentSection[] | null,
  after: readonly LegalDocumentSection[],
): LegalArticleComparison[] {
  if (before === null) {
    return [];
  }
  const beforeArticles = splitArticles(before);
  const afterArticles = splitArticles(after);
  const matchedBefore = new Set<number>();
  const pairOf = new Map<number, number>();
  afterArticles.forEach((article, afterIndex) => {
    const beforeIndex = beforeArticles.findIndex(
      (candidate, index) => !matchedBefore.has(index) && candidate.key === article.key,
    );
    if (beforeIndex >= 0) {
      matchedBefore.add(beforeIndex);
      pairOf.set(afterIndex, beforeIndex);
    }
  });

  // A removed article is anchored to the nearest kept article before it (-1: the start).
  const removedAfter = new Map<number, Article[]>();
  beforeArticles.forEach((article, index) => {
    if (matchedBefore.has(index)) {
      return;
    }
    let anchor = -1;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (matchedBefore.has(previous)) {
        anchor = previous;
        break;
      }
    }
    removedAfter.set(anchor, [...(removedAfter.get(anchor) ?? []), article]);
  });
  const removedRows = (anchor: number) =>
    (removedAfter.get(anchor) ?? []).map((article) =>
      entry('removed', article.heading, article.sections, []),
    );

  const rows: LegalArticleComparison[] = removedRows(-1);
  afterArticles.forEach((article, afterIndex) => {
    const beforeIndex = pairOf.get(afterIndex);
    if (beforeIndex === undefined) {
      rows.push(entry('added', article.heading, [], article.sections));
      return;
    }
    const previous = beforeArticles[beforeIndex]!;
    const change =
      canonicalJson(previous.sections) === canonicalJson(article.sections)
        ? 'unchanged'
        : 'changed';
    rows.push(entry(change, article.heading, previous.sections, article.sections));
    rows.push(...removedRows(beforeIndex));
  });
  return rows;
}
