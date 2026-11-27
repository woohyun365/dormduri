import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff, bffFailure } from '../../../ui/__stories__/bff-stub';
import {
  activeOwnerWithoutRecovery,
  issuedTotp,
  recoveryCodes,
} from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { SecurityScreen } from '../SecurityScreen';

// The operator's own credentials inside the console shell in three sections: ready, without recovery means, the TOTP
// and recovery codes shown once after a reissue, and a result under the title.

const meta = {
  title: 'Security/Screen',
  component: SecurityScreen,
  decorators: [consoleFrame],
  args: { passkeyCount: 2, totpConfirmed: true, recoveryCodesRemaining: 10 },
  parameters: { nextjs: { navigation: { pathname: '/security' } } },
} satisfies Meta<typeof SecurityScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const RecoveryMissing: Story = {
  args: { passkeyCount: 1, totpConfirmed: false, recoveryCodesRemaining: 0 },
  parameters: { consoleSession: activeOwnerWithoutRecovery },
};

const reissueTotp: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'TOTP 새로 발급' }));
  await canvas.findByTestId('totp-secret');
};

/** The new TOTP secret shown once in its section, with the confirmation form. */
export const TotpIssued: Story = {
  beforeEach: () => answerBff({ '/api/auth/totp': issuedTotp }),
  play: reissueTotp,
};

/** The TOTP confirmed: the result under the title. */
export const Success: Story = {
  beforeEach: () => answerBff({ '/api/auth/totp': issuedTotp, '/api/auth/totp/confirm': {} }),
  play: async (context) => {
    await reissueTotp(context);
    await context.userEvent.type(context.canvas.getByLabelText('인증 앱의 6자리 code'), '123456');
    await context.userEvent.click(context.canvas.getByRole('button', { name: 'TOTP 확인' }));
    await context.canvas.findByText('TOTP를 확인했습니다.');
  },
};

/** A reissue the API refused: the failure under the title. */
export const Error: Story = {
  beforeEach: () => answerBff({ '/api/auth/recovery-codes': bffFailure(429, 'rate_limited') }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^복구 code 새로 발급/u }));
    await canvas.findByText('시도가 너무 많습니다. 잠시 뒤 다시 시도하세요.');
  },
};

/** The new recovery codes shown once in their section. */
export const RecoveryCodesIssued: Story = {
  beforeEach: () => answerBff({ '/api/auth/recovery-codes': { recoveryCodes } }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^복구 code 새로 발급/u }));
    await canvas.findByRole('list', { name: '복구 code' });
  },
};
