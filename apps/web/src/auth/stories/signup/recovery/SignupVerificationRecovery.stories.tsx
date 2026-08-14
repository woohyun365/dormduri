import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupVerificationRecoveryScenario } from '../../fixtures/signup/SignupRecoveryStoryScenarios';

const meta = {
  title: 'Auth/Signup/Recovery/Email Verification/Proof Expired',
  component: SignupVerificationRecoveryScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupVerificationRecoveryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhileOpen: Story = {
  name: 'While Page Is Open',
  args: { scenario: 'expired' },
  parameters: {
    docs: {
      description: {
        story:
          '회원가입 페이지를 열어 둔 채 30분이 지나 client timer 또는 foreground 복귀 검사가 만료를 확인한 상태입니다. 이메일 외 입력은 초기화되고 Step 1에서 다시 인증합니다.',
      },
    },
  },
};

export const OnSubmit: Story = {
  name: 'Detected On Submit',
  args: { scenario: 'expired' },
  parameters: {
    docs: {
      description: {
        story:
          'Client timer가 지연된 상태에서 가입하기를 눌렀고 API가 proof 만료를 확인한 상태입니다. 동일한 초기화 경로를 사용하며 이전 Step 4로 복귀하지 않습니다.',
      },
    },
  },
};

export const CodeSentAfterRestart: Story = {
  name: 'Code Sent After Restart',
  args: { scenario: 'codeSent' },
  parameters: {
    docs: {
      description: {
        story:
          'Proof 만료로 초기화된 뒤 같은 학교 이메일로 새 인증 코드를 전송한 상태입니다. 새 10분 countdown을 사용합니다.',
      },
    },
  },
};
