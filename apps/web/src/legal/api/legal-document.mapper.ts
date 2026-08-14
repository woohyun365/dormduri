import type { LegalDocumentResponse, LegalDocumentSection } from '@repo/shared/legal';
import type {
  LegalDocumentHeadingSection,
  LegalDocumentTocItem,
  LegalDocumentViewModel,
  LegalDocumentViewSection,
} from '../model/legal-document.types';

function formatIsoDateLabel(value: string): string {
  return value.slice(0, 10);
}

function formatKoreanDateLabel(value: string): string {
  const [year, month, day] = formatIsoDateLabel(value).split('-');

  if (!year || !month || !day) {
    return formatIsoDateLabel(value);
  }

  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function normalizeHeadingId(input: string, index: number): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[\s/·]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug ? `section-${index + 1}-${slug}` : `section-${index + 1}`;
}

function mapSection(section: LegalDocumentSection, index: number): LegalDocumentViewSection {
  if (section.type !== 'heading') {
    return section;
  }

  return {
    ...section,
    id: normalizeHeadingId(section.text, index),
  } satisfies LegalDocumentHeadingSection;
}

function isHeadingSection(
  section: LegalDocumentViewSection,
): section is LegalDocumentHeadingSection {
  return section.type === 'heading';
}

function toTocItem(section: LegalDocumentHeadingSection): LegalDocumentTocItem {
  return {
    id: section.id,
    level: section.level,
    text: section.text,
  };
}

export function toLegalDocumentViewModel(document: LegalDocumentResponse): LegalDocumentViewModel {
  const sections = document.sections.map(mapSection);

  return {
    ...document,
    sections,
    tocItems: sections.filter(isHeadingSection).map(toTocItem),
    versionLabel: `${formatKoreanDateLabel(document.effectiveAt)} 시행본`,
    effectiveDateLabel: formatIsoDateLabel(document.effectiveAt),
    lastModifiedDateLabel: formatIsoDateLabel(document.lastModifiedAt),
  };
}
