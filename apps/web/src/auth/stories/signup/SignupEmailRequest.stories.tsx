import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupEmailScenario } from '../fixtures/signup/SignupEmailStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 1 School Email Verification/Request',
  component: SignupEmailScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupEmailScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Request: Story = {
  args: { scenario: 'request' },
};

export const Submitting: Story = {
  args: { scenario: 'submitting' },
};

export const RateLimited: Story = {
  name: 'Rate Limited',
  args: { scenario: 'rateLimited' },
};

export const RequestNetworkUnavailable: Story = {
  name: 'Request Network Unavailable',
  args: { scenario: 'requestNetworkUnavailable' },
};
