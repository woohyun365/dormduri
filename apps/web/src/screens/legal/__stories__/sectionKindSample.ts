import type { LegalDocumentResponse } from '@repo/shared/legal';

// Type-only import: the Storybook style test (e2e/storybook/legal.storybook.ts) reads this sample, and
// the Playwright loader cannot load the @repo/shared build.

// Every section kind and variant the contract allows (heading 2~4, paragraph, ordered and unordered
// list, table with caption, callout INFO and WARNING). For render coverage only; screen judgments use
// the real long documents.
export const sectionKindSample = {
  title: '문서 구성 견본',
  summaryItems: ['요약 항목 하나', '요약 항목 둘'],
  sections: [
    { type: 'heading', level: 2, text: '제1조(둘째 단계 제목)' },
    { type: 'paragraph', text: '문단 견본입니다. 긴 문장은 어절 단위로 줄을 바꿉니다.' },
    { type: 'heading', level: 3, text: '셋째 단계 제목' },
    { type: 'list', ordered: true, items: ['순서 있는 목록 첫째', '순서 있는 목록 둘째'] },
    { type: 'heading', level: 4, text: '넷째 단계 제목' },
    { type: 'list', ordered: false, items: ['순서 없는 목록 첫째', '순서 없는 목록 둘째'] },
    {
      type: 'table',
      caption: '표 견본',
      headers: ['구분', '내용', '기간'],
      rows: [
        ['첫째', '표 칸 견본', '1년'],
        ['둘째', '조금 더 긴 표 칸 견본 문장', '3년'],
      ],
    },
    { type: 'callout', tone: 'INFO', text: '안내 견본입니다.' },
    { type: 'callout', tone: 'WARNING', text: '주의 견본입니다.' },
  ],
  changeSummary: '변경 요약 견본입니다.',
} satisfies Pick<LegalDocumentResponse, 'title' | 'summaryItems' | 'sections' | 'changeSummary'>;
