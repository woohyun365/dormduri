import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupExitRecoveryScenario } from '../../fixtures/signup/SignupRecoveryStoryScenarios';

const meta = {
  title: 'Auth/Signup/Recovery/Exit',
  component: SignupExitRecoveryScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupExitRecoveryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileBackOrRefresh: Story = {
  name: 'Mobile / Back or Refresh',
  parameters: {
    viewport: { defaultViewport: 'webMobile390' },
    docs: {
      description: {
        story:
          '이메일 인증을 마친 모바일 Step 1 상태입니다. 실제 Header logo를 누르면 제품 이탈 확인 dialog가 열립니다. 뒤로가기·pull-to-refresh의 browser native prompt는 Storybook에서 재현하지 않습니다.',
      },
    },
  },
};

export const DesktopLogoExit: Story = {
  name: 'Desktop / Logo Exit',
  parameters: {
    viewport: { defaultViewport: 'webDesktop1280' },
    docs: {
      description: {
        story:
          '이메일 인증을 마친 PC Step 1 상태입니다. 실제 Header logo를 누르면 가입 중단 여부를 확인하는 제품 dialog가 열립니다. Browser back은 native guard로 처리합니다.',
      },
    },
  },
};
