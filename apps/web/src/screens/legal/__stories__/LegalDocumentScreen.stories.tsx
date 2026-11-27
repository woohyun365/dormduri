import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalDocumentKind } from '@repo/shared/legal';
import { withStoryLinks } from './storyLinks';
import {
  LegalDocumentScreen,
  LegalUnavailableScreen,
  LegalVersionNotFoundScreen,
} from '../LegalDocumentScreen';
import {
  STORY_CHECKED_AT,
  firstVersionComparison,
  privacyComparison,
  privacyPage,
  privacyPreviousComparison,
  privacyPreviousPage,
  privacyScheduledComparison,
  privacyScheduledPage,
  privacyWithScheduledPage,
  sectionKindPage,
  termsComparison,
  termsPage,
  termsPreviousComparison,
  termsPreviousPage,
  termsScheduledComparison,
  termsScheduledPage,
  termsWithScheduledPage,
} from './storyDocuments';

// The /privacy and /terms page, every state for both documents (Owner 2026-11-16). Inputs are the
// public reading contract's answers built from the development seed (storyDocuments.ts).

const meta = {
  title: 'Legal/Page',
  component: LegalDocumentScreen,
  tags: ['knu-layer', 'autodocs'],
  decorators: [withStoryLinks],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '/privacy·/terms 공개 문서 화면. 공개 열람 API의 판 응답(본문·판 목록·새 판 공지)과 조항 대조표를 그립니다. 입력은 개발 seed의 판으로 만든 계약 모양이고, 이용약관의 시행 예정·이전 판은 같은 본문에 날짜만 바꾼 표시용 견본입니다.',
      },
      story: { inline: false, height: '720px' },
    },
  },
  args: {
    page: privacyPage,
    source: { kind: 'published' },
    comparison: privacyComparison,
  },
} satisfies Meta<typeof LegalDocumentScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

const lastConfirmed = { kind: 'last-success', checkedAt: STORY_CHECKED_AT } as const;

export const Privacy: Story = { name: '개인정보 처리방침' };

export const Terms: Story = {
  name: '이용약관',
  args: { page: termsPage, comparison: termsComparison },
};

export const PrivacyLastConfirmed: Story = {
  name: '처리방침 · 마지막으로 확인한 판',
  args: { source: lastConfirmed },
};

export const TermsLastConfirmed: Story = {
  name: '이용약관 · 마지막으로 확인한 판',
  args: { page: termsPage, comparison: termsComparison, source: lastConfirmed },
};

export const PrivacyScheduled: Story = {
  name: '처리방침 · 새 판 공지',
  args: { page: privacyWithScheduledPage },
};

export const TermsScheduled: Story = {
  name: '이용약관 · 새 판 공지',
  args: { page: termsWithScheduledPage, comparison: termsComparison },
};

// Where '새 판 미리 보기' leads: the scheduled text with its status first and the comparison with the
// version in force. The terms sample is the same text, so its comparison says nothing changed.
export const PrivacyViewingScheduled: Story = {
  name: '처리방침 · 시행 예정 판 보기',
  args: { page: privacyScheduledPage, comparison: privacyScheduledComparison },
};

export const TermsViewingScheduled: Story = {
  name: '이용약관 · 시행 예정 판 보기',
  args: { page: termsScheduledPage, comparison: termsScheduledComparison },
};

// Where an earlier version's '보기' leads. The terms story assumes the sample version is in force.
export const PrivacyViewingPrevious: Story = {
  name: '처리방침 · 이전 판 보기',
  args: { page: privacyPreviousPage, comparison: privacyPreviousComparison },
};

export const TermsViewingPrevious: Story = {
  name: '이용약관 · 이전 판 보기',
  args: { page: termsPreviousPage, comparison: termsPreviousComparison },
};

export const PrivacyComparisonUnavailable: Story = {
  name: '처리방침 · 대조표 불러올 수 없음',
  args: { page: privacyScheduledPage, comparison: null },
};

export const TermsComparisonUnavailable: Story = {
  name: '이용약관 · 대조표 불러올 수 없음',
  args: { page: termsScheduledPage, comparison: null },
};

export const PrivacyVersionNotFound: Story = {
  name: '처리방침 · 없는 판',
  render: () => <LegalVersionNotFoundScreen kind={LegalDocumentKind.PRIVACY_POLICY} />,
};

export const TermsVersionNotFound: Story = {
  name: '이용약관 · 없는 판',
  render: () => <LegalVersionNotFoundScreen kind={LegalDocumentKind.TERMS_OF_SERVICE} />,
};

export const PrivacyUnavailable: Story = {
  name: '처리방침 · 문서 없음',
  render: () => <LegalUnavailableScreen kind={LegalDocumentKind.PRIVACY_POLICY} />,
};

export const TermsUnavailable: Story = {
  name: '이용약관 · 문서 없음',
  render: () => <LegalUnavailableScreen kind={LegalDocumentKind.TERMS_OF_SERVICE} />,
};

// Every section kind the contract allows, shown under each document's header. Render coverage only;
// screen judgments use the real long documents.
export const PrivacySectionKinds: Story = {
  name: '처리방침 · section 종류 견본',
  args: {
    page: sectionKindPage(LegalDocumentKind.PRIVACY_POLICY),
    comparison: firstVersionComparison(LegalDocumentKind.PRIVACY_POLICY, '2026-06-22'),
  },
};

export const TermsSectionKinds: Story = {
  name: '이용약관 · section 종류 견본',
  args: {
    page: sectionKindPage(LegalDocumentKind.TERMS_OF_SERVICE),
    comparison: firstVersionComparison(LegalDocumentKind.TERMS_OF_SERVICE, '2026-06-22'),
  },
};
