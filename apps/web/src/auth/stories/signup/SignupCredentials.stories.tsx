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

const checkNickname = async ({ canvas, userEvent }: Parameters<NonNullable<Story['play']>>[0]) => {
  await userEvent.click(canvas.getByRole('button', { name: '중복 확인' }));
};

export const UncheckedDefault: Story = {
  name: 'Unchecked / Default',
  args: { scenario: 'unchecked' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '계속하기' })).toBeDisabled();
  },
};

export const Checking: Story = {
  args: { scenario: 'checking' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('닉네임을 확인하고 있어요.')).toBeVisible();
  },
};

export const AvailableKorean: Story = {
  name: 'Available / Korean',
  args: { scenario: 'availableKorean' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible();
    await expect(context.canvas.getByRole('button', { name: '계속하기' })).toBeEnabled();
  },
};

export const AvailableEnglish: Story = {
  name: 'Available / English',
  args: { scenario: 'availableEnglish' },
  play: AvailableKorean.play,
};

export const RejectedFormat: Story = {
  name: 'Rejected / Format',
  args: { scenario: 'rejectedFormat' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('닉네임은 2자 이상이어야 합니다.')).toBeVisible();
  },
};

export const RejectedMixedScript: Story = {
  name: 'Rejected / Mixed Script',
  args: { scenario: 'rejectedMixedScript' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('한글과 영문은 함께 사용할 수 없어요.')).toBeVisible();
  },
};

export const RejectedModeration: Story = {
  name: 'Rejected / Moderation',
  args: { scenario: 'rejectedModeration' },
  play: async (context) => {
    await checkNickname(context);
    await expect(
      context.canvas.getByText('닉네임에 사용할 수 없는 단어가 포함되어 있어요.'),
    ).toBeVisible();
  },
};

export const RejectedAlreadyTaken: Story = {
  name: 'Rejected / Already Taken',
  args: { scenario: 'rejectedTaken' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('이미 사용 중인 닉네임이에요.')).toBeVisible();
  },
};

export const UnavailableNetwork: Story = {
  name: 'Unavailable / Network',
  args: { scenario: 'networkUnavailable' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('닉네임을 확인하지 못했어요')).toBeVisible();
    await expect(
      context.canvas.getByText('네트워크를 확인한 뒤 다시 시도해 주세요.'),
    ).toBeVisible();
  },
};

export const ExpiredSignupGrant: Story = {
  name: 'Expired / Signup Grant',
  args: { scenario: 'expiredGrant' },
  play: async (context) => {
    await checkNickname(context);
    await expect(context.canvas.getByText('학교 이메일 인증이 만료됐어요')).toBeVisible();
    await expect(context.canvas.getByText('학교 이메일을 다시 인증해 주세요.')).toBeVisible();
  },
};

export const StaleEditedAfterSuccess: Story = {
  name: 'Stale / Edited After Success',
  args: { scenario: 'staleEdited' },
  play: async (context) => {
    await checkNickname(context);
    const nicknameInput = context.canvas.getByRole('textbox', { name: /닉네임/ });
    await context.userEvent.clear(nicknameInput);
    await context.userEvent.type(nicknameInput, '새닉네임');
    await expect(
      context.canvas.getByText('닉네임을 수정했어요. 다시 확인해 주세요.'),
    ).toBeVisible();
    await expect(context.canvas.getByRole('button', { name: '계속하기' })).toBeDisabled();
  },
};

export const PasswordInvalidCharacters: Story = {
  name: 'Password / Invalid Characters',
  args: { scenario: 'passwordInvalidCharacters' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/영문·숫자·기호만 사용할 수 있어요/)).toBeVisible();
  },
};

export const PasswordWhitespace: Story = {
  name: 'Password / Whitespace',
  args: { scenario: 'passwordWhitespace' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/공백 없이 입력해 주세요/)).toBeVisible();
  },
};

export const PasswordConfirmationMismatch: Story = {
  name: 'Password / Confirmation Mismatch',
  args: { scenario: 'passwordMismatch' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/비밀번호 확인 일치/)).toHaveTextContent('확인 필요');
  },
};

export const PasswordMatchesEmailIdentity: Story = {
  name: 'Password / Email Identity',
  args: { scenario: 'passwordEmailIdentity' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/이메일 정보와 다름/)).toHaveTextContent('확인 필요');
  },
};

export const PasswordPolicyRejected: Story = {
  name: 'Password / Blocked Value',
  args: { scenario: 'passwordRejected' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('다른 비밀번호를 입력해 주세요.')).toBeVisible();
  },
};

export const RaceTakenAtFinalSignup: Story = {
  name: 'Race / Taken At Final Signup',
  args: { scenario: 'raceFinalSignup' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('4/5 · 학교·기본 정보')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '가입하기' })).toBeVisible();
  },
};
