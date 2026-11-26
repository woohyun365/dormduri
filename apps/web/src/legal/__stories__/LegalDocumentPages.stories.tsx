import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { Route } from 'next';
import { LegalDocumentKind, type LegalDocumentPageResponse } from '@repo/shared/legal';
import { LegalDocumentRouteView } from '../components/LegalDocumentRouteView';
import type { LegalLoadResult } from '../model/legal-document.types';
import { seedLegalDocumentPage } from '../test-support/legal-seed-documents';

type LegalStoryKind =
  typeof LegalDocumentKind.TERMS_OF_SERVICE | typeof LegalDocumentKind.PRIVACY_POLICY;

interface LegalDocumentPageStoryProps {
  kind: LegalStoryKind;
  state: LegalLoadResult<LegalDocumentPageResponse>['status'];
}

const ROUTES: Record<LegalStoryKind, Route> = {
  [LegalDocumentKind.TERMS_OF_SERVICE]: '/terms',
  [LegalDocumentKind.PRIVACY_POLICY]: '/privacy',
};

// Documents come from the legal seed through the test-only seed path.
function resultOf(
  kind: LegalStoryKind,
  state: LegalDocumentPageStoryProps['state'],
): LegalLoadResult<LegalDocumentPageResponse> {
  const page = seedLegalDocumentPage(kind);
  if (!page || state === 'unavailable') return { status: 'unavailable' };
  if (state === 'version-not-found') return { status: 'version-not-found' };
  if (state === 'last-success') {
    return { status: 'last-success', data: page, checkedAt: '2026-11-25T09:30:00.000Z' };
  }
  return { status: 'published', data: page };
}

function LegalDocumentPageStory({ kind, state }: LegalDocumentPageStoryProps) {
  return (
    <LegalDocumentRouteView result={resultOf(kind, state)} currentDocumentHref={ROUTES[kind]} />
  );
}

const meta = {
  title: 'Legal Page/Documents',
  component: LegalDocumentPageStory,
  parameters: {
    docs: {
      description: {
        component:
          '이용약관과 개인정보 처리방침 공개 page의 load 상태 넷입니다: API 게시본, API가 답하지 않을 때 마지막으로 확인한 판(확인 시각 안내), 마지막 성공본도 없을 때 불러올 수 없음, 없는 판 주소.',
      },
    },
  },
  argTypes: {
    kind: { table: { disable: true } },
    state: { table: { disable: true } },
  },
} satisfies Meta<typeof LegalDocumentPageStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TermsOfService: Story = {
  name: 'Terms of service / published',
  args: { kind: LegalDocumentKind.TERMS_OF_SERVICE, state: 'published' },
};

export const PrivacyPolicy: Story = {
  name: 'Privacy policy / published',
  args: { kind: LegalDocumentKind.PRIVACY_POLICY, state: 'published' },
};

export const PrivacyPolicyLastSuccess: Story = {
  name: 'Privacy policy / last success',
  args: { kind: LegalDocumentKind.PRIVACY_POLICY, state: 'last-success' },
};

export const Unavailable: Story = {
  name: 'Document unavailable',
  args: { kind: LegalDocumentKind.PRIVACY_POLICY, state: 'unavailable' },
};

export const VersionNotFound: Story = {
  name: 'Version not found',
  args: { kind: LegalDocumentKind.PRIVACY_POLICY, state: 'version-not-found' },
};
