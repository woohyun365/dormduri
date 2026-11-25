import { describe, expect, it } from 'vitest';
import { legalDraftCreateRequestSchema } from '@repo/shared/backoffice';
import type { LegalDraftContent } from '@repo/shared/backoffice';
import { describeIssues, editableContent, type SectionType } from './draft-form';

// The editor's model: section keys a server render and the browser's first render agree on, and refusal lines that
// always name a place the operator can find.

const CONTENT: LegalDraftContent = {
  kind: 'AGE_14_OR_ABOVE_NOTICE',
  contentSchemaVersion: 1,
  title: '만 14세 이상 확인',
  summaryItems: [],
  sections: [
    { type: 'heading', level: 2, text: '제1조(가입 나이)' },
    { type: 'paragraph', text: '만 14세 이상만 가입할 수 있습니다.' },
  ],
  changeSummary: '첫 게시',
  noticeClass: 'INITIAL',
  consentRequired: false,
  proposedEffectiveDate: '2026-06-22',
  appliesUntil: null,
};

const IMPORT = {
  kind: CONTENT.kind,
  contentSchemaVersion: 1,
  title: CONTENT.title,
  summaryItems: [],
  sections: CONTENT.sections,
  changeSummary: CONTENT.changeSummary,
  noticeClass: CONTENT.noticeClass,
  consentRequired: false,
  proposedEffectiveDate: CONTENT.proposedEffectiveDate,
};

function refusal(draft: unknown, sectionTypes: SectionType[]): string[] {
  const parsed = legalDraftCreateRequestSchema.safeParse({ source: 'import', draft });
  if (parsed.success) throw new Error('expected a refusal');
  return describeIssues(parsed.error.issues, sectionTypes, 1);
}

describe('editableContent', () => {
  it('keys the sections of the same content the same way on every read', () => {
    const first = editableContent(CONTENT).sections.map(({ key }) => key);
    const second = editableContent(CONTENT).sections.map(({ key }) => key);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe('describeIssues', () => {
  it('names the file as a whole when the refusal is about the draft itself', () => {
    const lines = [
      ...refusal({ ...IMPORT, extra: 1 }, ['heading', 'paragraph']),
      ...refusal([], []),
    ];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain('undefined');
      expect(line).toMatch(/^파일 전체: /u);
    }
  });

  it('names a section of an unknown type by its place only', () => {
    const lines = refusal({ ...IMPORT, sections: [{ type: 'image', text: 'x' }] }, [
      'image' as SectionType,
    ]);
    expect(lines).toEqual(['본문 1: 형식이 맞지 않습니다.']);
  });
});
