import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalDocumentKind, legalRevisionNoticesResponseSchema } from '@repo/shared/legal';
import { LandingScreen } from '../LandingScreen';

// The whole landing page. Each section and part has its own stories under Landing/Sections and
// Landing/Components. Not visual-tagged: the landing keeps no screenshot baselines.

const meta = {
  title: 'Landing/Page',
  component: LandingScreen,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '랜딩 전체 화면(Glide 구조). 어두운 판 하나이고 OS 색 설정을 따르지 않습니다. logo는 header·footer의 로고 색입니다. 법적 문서의 시행 예정 판이 있으면 header 위에 문서마다 한 줄인 개정 예고 띠가 보입니다.',
      },
      story: { inline: false, height: '720px' },
    },
  },
  argTypes: {
    logo: { control: 'inline-radio', options: ['color', 'white'] },
    revisionNotices: { table: { disable: true } },
  },
} satisfies Meta<typeof LandingScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };

// The public reading API's answer with a scheduled version of both public documents, in the API's
// order (terms first) to show the page's own order. Display sample dates; the seed has no scheduled
// version.
const scheduledBoth = legalRevisionNoticesResponseSchema.parse({
  notices: [
    {
      kind: LegalDocumentKind.TERMS_OF_SERVICE,
      versionKey: '2026-12-14',
      status: 'scheduled',
      appliesFrom: '2026-12-14',
      appliesUntil: null,
      changeSummary: '표시용 견본: 새 판의 변경 요약입니다.',
      consentRequired: false,
    },
    {
      kind: LegalDocumentKind.PRIVACY_POLICY,
      versionKey: '2026-12-14',
      status: 'scheduled',
      appliesFrom: '2026-12-14',
      appliesUntil: null,
      changeSummary: '표시용 견본: 새 판의 변경 요약입니다.',
      consentRequired: false,
    },
  ],
}).notices;

export const RevisionNotice: Story = {
  name: '개정 예고',
  args: { revisionNotices: scheduledBoth },
};
