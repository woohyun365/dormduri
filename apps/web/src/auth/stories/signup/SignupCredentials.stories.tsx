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
  args: { scenario: 'default' },
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
