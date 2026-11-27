import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import { passkeyOptions } from '../../../ui/__stories__/fixtures';
import { authFrame } from '../../../ui/__stories__/frames';
import { answerPasskeyCreation } from '../../../ui/__stories__/passkey-stub';
import { RecoveryScreen } from '../RecoveryScreen';

// The recovery session screen: it can only register a new passkey and log out (the passkey answered by
// passkey-stub.ts).

const meta = {
  title: 'Auth/Recovery',
  component: RecoveryScreen,
  decorators: [authFrame],
  args: { displayName: '시험 운영자' },
} satisfies Meta<typeof RecoveryScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewPasskey: Story = {};

/** The new passkey registered: log out and sign in with it. */
export const Registered: Story = {
  beforeEach: () => {
    const restoreBff = answerBff({
      '/api/auth/passkeys/options': passkeyOptions,
      '/api/auth/passkeys': {},
    });
    const restorePasskey = answerPasskeyCreation();
    return () => {
      restorePasskey();
      restoreBff();
    };
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '새 passkey 등록' }));
    await canvas.findByText(
      '새 passkey를 등록했습니다. 로그아웃한 뒤 새 passkey로 다시 로그인하세요.',
    );
  },
};
