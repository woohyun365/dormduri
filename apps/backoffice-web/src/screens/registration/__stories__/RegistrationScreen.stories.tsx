import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff } from '../../../ui/__stories__/bff-stub';
import { registrationInvitation, STORY_INVITATION_CODE } from '../../../ui/__stories__/fixtures';
import { authFrame } from '../../../ui/__stories__/frames';
import { RegistrationScreen } from '../RegistrationScreen';

// The invitation registration: the invitation code, then the password and passkey step of the invited account. The
// values shown once after the passkey are the Credentials stories (the passkey needs a real authenticator).

const meta = {
  title: 'Auth/Registration',
  component: RegistrationScreen,
  decorators: [authFrame],
} satisfies Meta<typeof RegistrationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InvitationCode: Story = {};

export const PasswordAndPasskey: Story = {
  beforeEach: () => answerBff({ '/api/auth/registration/options': registrationInvitation }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('등록 code'), STORY_INVITATION_CODE);
    await userEvent.click(canvas.getByRole('button', { name: '다음' }));
    await canvas.findByRole('button', { name: 'passkey 만들고 등록' });
  },
};
