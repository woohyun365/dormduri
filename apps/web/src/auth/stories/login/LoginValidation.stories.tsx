import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import { validateLoginForm } from '@/auth/flows/login/model/login-form.validation';
import { LOGIN_STORY_BASE_ARGS } from '../fixtures/auth-story-fixtures';

const meta = {
  title: 'Auth/Login/Validation',
  component: LoginFlowView,
  parameters: { layout: 'fullscreen' },
  args: LOGIN_STORY_BASE_ARGS,
} satisfies Meta<typeof LoginFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

const EMPTY_EMAIL_VALUES = {
  email: '',
  password: 'ExamplePassword123!',
  rememberMe: false,
};

const EMPTY_PASSWORD_VALUES = {
  email: LOGIN_STORY_BASE_ARGS.values.email,
  password: '',
  rememberMe: false,
};

const INVALID_EMAIL_VALUES = {
  email: 'student@example.com',
  password: 'ExamplePassword123!',
  rememberMe: false,
};

export const EmptyEmail: Story = {
  name: 'Empty Email',
  args: {
    values: EMPTY_EMAIL_VALUES,
    fieldErrors: validateLoginForm(EMPTY_EMAIL_VALUES),
    lastInvalidField: 'email',
    invalidSubmitCount: 1,
  },
};

export const EmptyPassword: Story = {
  name: 'Empty Password',
  args: {
    values: EMPTY_PASSWORD_VALUES,
    fieldErrors: validateLoginForm(EMPTY_PASSWORD_VALUES),
    lastInvalidField: 'password',
    invalidSubmitCount: 1,
  },
};

export const InvalidEmail: Story = {
  name: 'Invalid Email',
  args: {
    values: INVALID_EMAIL_VALUES,
    fieldErrors: validateLoginForm(INVALID_EMAIL_VALUES),
    lastInvalidField: 'email',
    invalidSubmitCount: 1,
  },
};
