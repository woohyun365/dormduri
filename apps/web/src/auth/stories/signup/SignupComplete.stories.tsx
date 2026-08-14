import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignupCompleteScenario } from '../fixtures/signup/SignupCompleteStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 5 Complete',
  component: SignupCompleteScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupCompleteScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};

export const Mobile320: Story = {
  parameters: {
    viewport: { defaultViewport: 'webMobile320' },
  },
};

export const MaxLengthNickname: Story = {
  args: {
    nickname: '포근한감자한조각',
  },
  parameters: {
    viewport: { defaultViewport: 'webMobile320' },
  },
};
