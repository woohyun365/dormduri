import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupLegalScenario } from '../fixtures/signup/SignupLegalStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 2 Legal',
  component: SignupLegalScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupLegalScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Entry: Story = {
  args: { scenario: 'entry' },
};

export const AllAgreed: Story = {
  name: 'All Agreed',
  args: { scenario: 'agreed' },
};

export const Fallback: Story = {
  args: { scenario: 'fallback' },
};

export const Stale: Story = {
  args: { scenario: 'stale' },
};
