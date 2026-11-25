import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { activeAuditor } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { legalOverview, legalOverviewMany } from '../../../ui/__stories__/legal-fixtures';
import { Forbidden as ForbiddenPage } from '../../../ui/Forbidden';
import { LegalDocumentsScreen } from '../LegalDocumentsScreen';

// Every document kind's published versions inside the console shell: a scheduled, a current and a historical privacy
// policy, two first publications, and a kind without any version yet.

const meta = {
  title: 'Legal/Documents',
  component: LegalDocumentsScreen,
  decorators: [consoleFrame],
  args: { overview: legalOverview },
  parameters: { nextjs: { navigation: { pathname: '/legal' } } },
} satisfies Meta<typeof LegalDocumentsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Documents: Story = {};

/** Nothing published yet (before the first publication): every kind says so. */
export const Empty: Story = { args: { overview: { documents: [] } } };

/** A long history with a withdrawn version, for the row height. */
export const ManyVersions: Story = { args: { overview: legalOverviewMany } };

export const Narrow: Story = { globals: { viewport: { value: 'mobile390' } } };

/** An operator without either legal permission. */
export const Forbidden: Story = {
  render: () => <ForbiddenPage title="문서 판" />,
  parameters: { consoleSession: activeAuditor },
};
