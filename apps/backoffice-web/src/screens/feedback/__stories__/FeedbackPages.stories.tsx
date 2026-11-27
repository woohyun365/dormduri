import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ErrorScreen, NotFoundScreen } from '../FeedbackScreens';

// The pages outside the console: a missing page (404) and a page the API could not give, with its retry. A missing
// permission (403) is the console page's own body (UI/Parts ForbiddenNotice, Audit/Screen Forbidden).

const meta = {
  title: 'Feedback/Pages',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFound: Story = { render: () => <NotFoundScreen /> };

export const Error: Story = { render: () => <ErrorScreen onRetry={() => undefined} /> };
