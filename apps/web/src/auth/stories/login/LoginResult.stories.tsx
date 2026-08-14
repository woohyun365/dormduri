import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginResultStoryScenario } from '../fixtures/login/LoginResultStoryScenario';

const meta = {
  title: 'Auth/Login/Result',
  component: LoginResultStoryScenario,
  parameters: { layout: 'fullscreen' },
  args: { scenario: 'invalidCredentials' },
} satisfies Meta<typeof LoginResultStoryScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InvalidCredentials: Story = {
  name: 'Invalid Credentials',
  args: { scenario: 'invalidCredentials' },
};

export const Locked: Story = {
  args: { scenario: 'locked' },
};

export const Throttled: Story = {
  args: { scenario: 'throttled' },
};

export const NetworkError: Story = {
  name: 'Network Error',
  args: { scenario: 'network' },
};

export const ServerUnavailable: Story = {
  name: 'Server Unavailable',
  args: { scenario: 'serverUnavailable' },
};

export const ResetComplete: Story = {
  name: 'Reset Complete',
  args: { scenario: 'resetComplete' },
};
