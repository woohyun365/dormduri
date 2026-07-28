import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupReopenedBeforeProofExpiryScenario } from '../../fixtures/signup/SignupRecoveryStoryScenarios';

const meta = {
  title: 'Auth/Signup/Recovery/Session',
  component: SignupReopenedBeforeProofExpiryScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupReopenedBeforeProofExpiryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReopenedBeforeProofExpiry: Story = {
  name: 'Reopened Before Proof Expiry',
  parameters: {
    docs: {
      description: {
        story:
          '이메일 인증 후 30분이 지나기 전에 탭을 닫고 다시 회원가입 페이지를 연 상태입니다. Browser draft를 저장하지 않으므로 만료 전이라도 새로운 Step 1에서 시작합니다.',
      },
    },
  },
};
