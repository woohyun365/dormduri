import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { issuedTotp, recoveryCodes } from '../../../ui/__stories__/fixtures';
import { Card } from '../../../ui/Card';
import { RecoveryCodeList, TotpEnrollment } from '../IssuedCredentials';

// One-time credentials (TOTP secret, recovery codes) as registration and the security screen show them. Fake values.

const meta = {
  title: 'Credentials/IssuedCredentials',
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecoveryCodes: Story = {
  render: () => (
    <Card id="story-recovery-codes" title="복구 code">
      <RecoveryCodeList codes={recoveryCodes} />
    </Card>
  ),
};

export const Totp: Story = {
  render: () => (
    <Card id="story-totp" title="TOTP 등록">
      <TotpEnrollment totp={issuedTotp} onConfirmed={() => undefined} />
    </Card>
  ),
};
