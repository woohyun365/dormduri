import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupEmailScenario } from '../fixtures/signup/SignupEmailStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 1 Email',
  component: SignupEmailScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupEmailScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Request: Story = {
  args: { scenario: 'request' },
};

export const Code: Story = {
  args: { scenario: 'code' },
};

export const Verified: Story = {
  args: { scenario: 'verified' },
};

export const InvalidCode: Story = {
  name: 'Invalid Code',
  args: { scenario: 'invalidCode' },
};

export const RateLimited: Story = {
  name: 'Rate Limited',
  args: { scenario: 'rateLimited' },
};
