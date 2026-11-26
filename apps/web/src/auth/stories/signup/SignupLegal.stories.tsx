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

// The signup documents could not be read: the step blocks signup.
export const Unavailable: Story = {
  args: { scenario: 'unavailable' },
};

export const Stale: Story = {
  args: { scenario: 'stale' },
};
