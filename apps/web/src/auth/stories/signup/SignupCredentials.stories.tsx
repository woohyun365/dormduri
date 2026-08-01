import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { SignupCredentialsScenario } from '../fixtures/signup/SignupCredentialsStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 3 Credentials',
  component: SignupCredentialsScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupCredentialsScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Allowed / Korean',
  args: { scenario: 'default' },
};

export const EnglishAllowed: Story = {
  name: 'Allowed / English',
  args: { scenario: 'englishAllowed' },
};

export const MixedScriptRejected: Story = {
  name: 'Rejected / Mixed Script',
  args: { scenario: 'mixedScript' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '계속하기' }));
    await expect(canvas.getByText('한글과 영문은 함께 사용할 수 없어요.')).toBeVisible();
  },
};

export const ModerationRejected: Story = {
  name: 'Rejected / Moderation',
  args: { scenario: 'moderationRejected' },
};

export const Validation: Story = {
  args: { scenario: 'validation' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '계속하기' }));
    await expect(canvas.getByText('닉네임을 입력해주세요.')).toBeVisible();
  },
};

export const NicknameConflict: Story = {
  name: 'Nickname Conflict',
  args: { scenario: 'nicknameConflict' },
};

export const Submitting: Story = {
  args: { scenario: 'submitting' },
};

export const NetworkUnavailable: Story = {
  name: 'Network Unavailable',
  args: { scenario: 'networkUnavailable' },
};
