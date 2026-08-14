import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ErrorRecoveryView } from '../ErrorRecoveryView';

const meta = {
  title: 'System/Operational Observability/Error Recovery',
  component: ErrorRecoveryView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '예상하지 못한 route 또는 root render 오류가 발생했을 때 production에서 사용하는 복구 화면입니다.',
      },
    },
  },
  args: {
    onRecover: () => undefined,
  },
  argTypes: {
    onRecover: {
      table: { disable: true },
    },
  },
} satisfies Meta<typeof ErrorRecoveryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RouteDefault: Story = {
  name: 'Route / Default',
  args: {
    scope: 'route',
  },
};

export const RouteRetrying: Story = {
  name: 'Route / Retrying',
  args: {
    scope: 'route',
    recovering: true,
  },
};

export const GlobalDefault: Story = {
  name: 'Global / Default',
  args: {
    scope: 'global',
  },
};
