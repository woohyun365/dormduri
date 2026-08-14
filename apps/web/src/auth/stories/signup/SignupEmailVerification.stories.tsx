import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { SignupEmailScenario } from '../fixtures/signup/SignupEmailStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 1 School Email Verification/Code',
  component: SignupEmailScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupEmailScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Code: Story = {
  args: { scenario: 'code' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '재전송 · 9:53' })).toBeDisabled();
  },
};

export const Verified: Story = {
  args: { scenario: 'verified' },
};

export const ResendAvailable: Story = {
  name: 'Resend Available',
  args: { scenario: 'resendAvailable' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '재전송' })).toBeEnabled();
  },
};

export const Resending: Story = {
  args: { scenario: 'resending' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '전송 중...' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: '인증 확인' })).toBeDisabled();
  },
};

export const ResendSuccess: Story = {
  name: 'Resend Success',
  args: { scenario: 'resendSuccess' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('새 인증 코드를 보냈어요')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '재전송 · 9:53' })).toBeDisabled();
  },
};

export const ResendFailed: Story = {
  name: 'Resend Failed',
  args: { scenario: 'resendFailed' },
};

export const InvalidCode: Story = {
  name: 'Invalid Code',
  args: { scenario: 'invalidCode' },
};

export const TooManyAttempts: Story = {
  name: 'Too Many Attempts',
  args: { scenario: 'tooManyAttempts' },
};

export const VerificationNetworkUnavailable: Story = {
  name: 'Verification Network Unavailable',
  args: { scenario: 'verificationNetworkUnavailable' },
};
