import type { z } from 'zod';
import type { LegalDraftContent } from '@repo/shared/backoffice';
import {
  LEGAL_CONSENT_KINDS,
  type LegalDocumentDraftImport,
  type LegalDocumentKind,
  type LegalDocumentSection,
  type LegalNoticeClass,
} from '@repo/shared/legal';

// The editor's model of a draft: the stored content with a stable key per section (so a moved section keeps its
// inputs), the import body a save sends, and the contract's issues said in the editor's words.

export type SectionType = LegalDocumentSection['type'];

export type EditableSection = { readonly key: string; readonly section: LegalDocumentSection };

export type EditableContent = Omit<LegalDraftContent, 'sections'> & {
  readonly sections: readonly EditableSection[];
};

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  heading: '조 제목',
  paragraph: '문단',
  list: '목록',
  table: '표',
  callout: '안내 상자',
};

let addedSeed = 0;
/**
 * A key for a section the operator adds. Only the browser makes one, after the page drew the saved sections, so a server
 * render never takes one and the two renders agree on every id built from a key.
 */
export function sectionKey(): string {
  addedSeed += 1;
  return `added-${addedSeed}`;
}

/** The saved sections keyed by their place: the same content gets the same keys on the server and in the browser. */
export function editableContent(content: LegalDraftContent): EditableContent {
  return {
    ...content,
    sections: content.sections.map((section, index) => ({ key: `saved-${index}`, section })),
  };
}

function bodySection(section: LegalDocumentSection): LegalDocumentSection {
  // An empty caption is no caption: the contract's caption is optional but never empty.
  if (section.type === 'table' && !section.caption?.trim()) {
    return { type: 'table', headers: section.headers, rows: section.rows };
  }
  return section;
}

/** The shared import body (`legalDocumentDraftImportSchema` input) of the content as it is now. */
export function importBody(content: EditableContent): LegalDocumentDraftImport {
  return {
    kind: content.kind,
    contentSchemaVersion: 1,
    title: content.title,
    summaryItems: [...content.summaryItems],
    sections: content.sections.map(({ section }) => bodySection(section)),
    changeSummary: content.changeSummary,
    noticeClass: content.noticeClass,
    consentRequired: content.consentRequired,
    proposedEffectiveDate: content.proposedEffectiveDate,
    // Only a historical record has an applies-until date (the contract refuses it on any other class).
    ...(content.noticeClass === 'HISTORICAL' && content.appliesUntil
      ? { appliesUntil: content.appliesUntil }
      : {}),
  };
}

/** A document kind asked for again at signup (`AGREE`) can ask for consent again (LB-R11). */
export function canAskConsent(kind: LegalDocumentKind, noticeClass: LegalNoticeClass): boolean {
  return LEGAL_CONSENT_KINDS.includes(kind) && noticeClass !== 'HISTORICAL';
}

const FIELD_LABELS: Record<string, string> = {
  kind: '문서',
  contentSchemaVersion: '본문 형식',
  title: '제목',
  summaryItems: '요약 항목',
  sections: '본문',
  changeSummary: '변경 요약',
  noticeClass: '고지 등급',
  consentRequired: '재동의 필요',
  proposedEffectiveDate: '제안 시행일',
  appliesUntil: '적용 끝',
};

// The shared contract's own refinement messages (packages/shared legal contract), in the editor's words.
const CONTRACT_MESSAGES: Record<string, string> = {
  'Only a historical record has an applies-until date, and it always has one':
    '이전 판 기록만 적용 끝이 있고, 이전 판 기록에는 늘 있어야 합니다.',
  'The applies-until date cannot be before the effective date': '시행일보다 앞일 수 없습니다.',
  'Only a signup consent kind in force can ask for consent again':
    '가입 때 동의받는 문서에만 켤 수 있고, 이전 판 기록에는 켤 수 없습니다.',
  'A significant terms of service change asks for consent again':
    '이용약관의 중대 변경은 재동의가 필요합니다.',
  'Expected a YYYY-MM-DD calendar date': '날짜(YYYY-MM-DD)를 고르세요.',
};

function issueText(issue: z.core.$ZodIssue): string {
  const known = CONTRACT_MESSAGES[issue.message];
  if (known) return known;
  if (issue.code === 'too_small') return '비어 있습니다.';
  if (issue.code === 'too_big') return '너무 깁니다.';
  return '형식이 맞지 않습니다.';
}

function issuePlace(path: readonly PropertyKey[], sections: readonly SectionType[]): string {
  const [field, index] = path;
  // An issue about the draft itself (not an object, or a key the contract does not know) has no field.
  if (field === undefined) return '파일 전체';
  const name = FIELD_LABELS[String(field)] ?? String(field);
  if (field === 'sections' && typeof index === 'number') {
    // A type the contract does not know (an imported file) has no label; the place alone names it.
    const label = SECTION_TYPE_LABELS[sections[index] as SectionType] as string | undefined;
    return `본문 ${index + 1}${label ? `(${label})` : ''}`;
  }
  if (field === 'summaryItems' && typeof index === 'number') return `요약 항목 ${index + 1}`;
  return name;
}

/**
 * The places and reasons the contract refuses, one line each and in document order of the first of each place (a table
 * with three empty cells is one line). `prefix` drops the path part before the draft fields (`draft` in a save body).
 */
export function describeIssues(
  issues: readonly z.core.$ZodIssue[],
  sections: readonly SectionType[],
  prefix = 0,
): string[] {
  const lines = new Map<string, string>();
  for (const issue of issues) {
    const place = issuePlace(issue.path.slice(prefix), sections);
    if (!lines.has(place)) lines.set(place, `${place}: ${issueText(issue)}`);
  }
  return [...lines.values()];
}
