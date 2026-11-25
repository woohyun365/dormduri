import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import {
  issuedTotp,
  recoveryCodes,
  registrationInvitation,
  STORY_INVITATION_CODE,
  STORY_PASSWORD,
} from '../../../ui/__stories__/fixtures';
import { authFrame } from '../../../ui/__stories__/frames';
import { answerPasskeyCreation } from '../../../ui/__stories__/passkey-stub';
import { RegistrationScreen } from '../RegistrationScreen';

// The invitation registration: the invitation code, the password and passkey step of the invited account, then the
// TOTP secret and recovery codes shown once (the passkey answered by passkey-stub.ts).

const meta = {
  title: 'Auth/Registration',
  component: RegistrationScreen,
  decorators: [authFrame],
} satisfies Meta<typeof RegistrationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InvitationCode: Story = {};

const codeStep: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText('등록 code'), STORY_INVITATION_CODE);
  await userEvent.click(canvas.getByRole('button', { name: '다음' }));
  await canvas.findByRole('button', { name: 'passkey 만들고 등록' });
};

export const PasswordAndPasskey: Story = {
  beforeEach: () => answerBff({ '/api/auth/registration/options': registrationInvitation }),
  play: codeStep,
};

/** Registered: the recovery codes and the TOTP secret shown once, with the TOTP confirmation. */
export const Issued: Story = {
  beforeEach: () => {
    const restoreBff = answerBff({
      '/api/auth/registration/options': registrationInvitation,
      '/api/auth/registration': { totp: issuedTotp, recoveryCodes },
    });
    const restorePasskey = answerPasskeyCreation();
    return () => {
      restorePasskey();
      restoreBff();
    };
  },
  play: async (context) => {
    const { canvas, userEvent } = context;
    await codeStep(context);
    await userEvent.type(canvas.getByLabelText('비밀번호', { exact: true }), STORY_PASSWORD);
    await userEvent.type(canvas.getByLabelText('비밀번호 확인'), STORY_PASSWORD);
    await userEvent.click(canvas.getByRole('button', { name: 'passkey 만들고 등록' }));
    await canvas.findByTestId('totp-secret');
  },
};
