import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupSubmissionRecoveryScenario } from '../../fixtures/signup/SignupRecoveryStoryScenarios';

const meta = {
  title: 'Auth/Signup/Recovery/Submission',
  component: SignupSubmissionRecoveryScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupSubmissionRecoveryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NetworkFailure: Story = {
  name: 'Network Failure',
  args: { scenario: 'failed' },
};

export const Retrying: Story = {
  name: 'Retrying Submission',
  args: { scenario: 'retrying' },
};
