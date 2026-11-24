import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import { loginChallenge, OWNER_EMAIL, STORY_PASSWORD } from '../../../ui/__stories__/fixtures';
import { authFrame } from '../../../ui/__stories__/frames';
import { LoginScreen } from '../LoginScreen';

// Each step of the login: the password step with each notice of an ended access, then the second factor and the
// recovery login. A later step opens the way an operator does, by answering the password with a fixture challenge.

const meta = {
  title: 'Auth/Login',
  component: LoginScreen,
  decorators: [authFrame],
  args: { ended: null },
} satisfies Meta<typeof LoginScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Password: Story = {};

export const EndedIdle: Story = { args: { ended: 'idle' } };

export const EndedExpired: Story = { args: { ended: 'expired' } };

export const LogoutUnconfirmed: Story = { args: { ended: 'unconfirmed' } };

const passwordStep: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText('이메일'), OWNER_EMAIL);
  await userEvent.type(canvas.getByLabelText('비밀번호'), STORY_PASSWORD);
  await userEvent.click(canvas.getByRole('button', { name: '다음' }));
  await canvas.findByRole('button', { name: 'passkey로 로그인' });
};

/** The passkey step, with both recovery logins offered. */
export const SecondFactor: Story = {
  beforeEach: () => answerBff({ '/api/auth/login/password': loginChallenge }),
  play: passwordStep,
};

/** The passkey step of an account with neither TOTP nor recovery codes: no recovery login is offered. */
export const SecondFactorWithoutRecovery: Story = {
  beforeEach: () =>
    answerBff({
      '/api/auth/login/password': {
        ...loginChallenge,
        recovery: { totp: false, recoveryCode: false },
      },
    }),
  play: passwordStep,
};

export const RecoveryWithTotp: Story = {
  beforeEach: () => answerBff({ '/api/auth/login/password': loginChallenge }),
  play: async (context) => {
    await passwordStep(context);
    await context.userEvent.click(
      context.canvas.getByRole('button', { name: 'TOTP code로 복구 로그인' }),
    );
    await context.canvas.findByLabelText('TOTP code(6자리)');
  },
};

export const RecoveryWithCode: Story = {
  beforeEach: () => answerBff({ '/api/auth/login/password': loginChallenge }),
  play: async (context) => {
    await passwordStep(context);
    await context.userEvent.click(
      context.canvas.getByRole('button', { name: '복구 code로 복구 로그인' }),
    );
    await context.canvas.findByLabelText('복구 code');
  },
};
