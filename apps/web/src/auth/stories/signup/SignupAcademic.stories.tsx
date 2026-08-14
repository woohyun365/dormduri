import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { getSignupCampusMatchingCopy } from '@/auth/flows/signup/model/signup-academic-copy';
import { SignupAcademicScenario } from '../fixtures/signup/SignupAcademicStoryScenario';

const meta = {
  title: 'Auth/Signup/Step 4 Academic Identity',
  component: SignupAcademicScenario,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignupAcademicScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { scenario: 'default' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radio', { name: '춘천캠퍼스' })).not.toBeChecked();
    await expect(canvas.getByRole('radio', { name: '남성' })).not.toBeChecked();
    await expect(canvas.getByLabelText(/단과대/)).toHaveValue('');
    await expect(canvas.getByLabelText(/출생연도/)).toHaveValue('');
  },
};

export const Validation: Story = {
  args: { scenario: 'validation' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }));
    await expect(canvas.getByText('캠퍼스를 선택해주세요.')).toBeVisible();
  },
};

export const SamcheokCampus: Story = {
  args: { scenario: 'samcheok' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radio', { name: '삼척캠퍼스' })).toBeChecked();
    await expect(canvas.getByRole('option', { name: '공학대' })).toBeVisible();
    await expect(canvas.getByRole('option', { name: '인문사회대' })).toBeVisible();
    await expect(canvas.getByRole('option', { name: '디자인스포츠대' })).toBeVisible();
    await expect(canvas.getByText(getSignupCampusMatchingCopy('SAMCHEOK'))).toBeVisible();
  },
};

export const DogyeCampus: Story = {
  args: { scenario: 'dogye' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radio', { name: '도계캠퍼스' })).toBeChecked();
    await expect(canvas.getByRole('option', { name: '보건과학대' })).toBeVisible();
    await expect(canvas.getByRole('option', { name: '자유전공학부' })).toBeVisible();
    await expect(canvas.getByText(getSignupCampusMatchingCopy('DOGYE'))).toBeVisible();
  },
};

export const Submitting: Story = {
  args: { scenario: 'submitting' },
};
