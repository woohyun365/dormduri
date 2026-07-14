import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalDocumentKind } from '@repo/shared/legal';
import { toLegalDocumentViewModel } from '../api/legal-document.mapper';
import { LegalDocumentLayout } from '../components/LegalDocumentLayout';
import { LEGAL_FALLBACK_DOCUMENTS } from '../content/legal-fallback-documents';
import type { LegalDocumentSource } from '../model/legal-document.types';

interface LegalDocumentPageStoryProps {
  kind: LegalDocumentKind;
  source: LegalDocumentSource;
}

function LegalDocumentPageStory({ kind, source }: LegalDocumentPageStoryProps) {
  return (
    <LegalDocumentLayout
      document={toLegalDocumentViewModel(LEGAL_FALLBACK_DOCUMENTS[kind])}
      source={source}
    />
  );
}

const meta = {
  title: 'Legal Page/Documents',
  component: LegalDocumentPageStory,
  parameters: {
    docs: {
      description: {
        component:
          '이용약관과 개인정보 처리방침 공개 page를 Storybook에서 확인하는 시나리오입니다. API 실패 fallback notice와 본문 구조를 함께 smoke test합니다.',
      },
    },
  },
  argTypes: {
    kind: { table: { disable: true } },
    source: { table: { disable: true } },
  },
} satisfies Meta<typeof LegalDocumentPageStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TermsOfService: Story = {
  name: 'Terms of service / fallback document',
  args: {
    kind: LegalDocumentKind.TERMS_OF_SERVICE,
    source: 'fallback',
  },
};

export const PrivacyPolicy: Story = {
  name: 'Privacy policy / fallback document',
  args: {
    kind: LegalDocumentKind.PRIVACY_POLICY,
    source: 'fallback',
  },
};
