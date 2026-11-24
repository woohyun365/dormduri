import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { auditEvents, auditNames } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import { Section } from '../../../ui/forms';
import { AuditReviewForm } from '../AuditReviewForm';
import { AuditTable } from '../AuditTable';

// The audit list and the monthly review form in the sections of the audit page, inside the console shell.

const meta = {
  title: 'Audit/Screen',
  decorators: [consoleFrame],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Events: Story = {
  render: () => (
    <>
      <h1 className="text-title-1 font-semibold text-fg-neutral">감사 기록</h1>
      <Section id="audit-review" title="월 점검 기록">
        <AuditReviewForm />
      </Section>
      <Section id="audit-events" title="최근 기록">
        <AuditTable events={auditEvents} names={auditNames} />
      </Section>
    </>
  ),
};

/** An auditor without the owner role reads account ids, not names. */
export const IdsOnly: Story = {
  render: () => (
    <Section id="audit-events" title="최근 기록">
      <AuditTable events={auditEvents} names={{}} />
    </Section>
  ),
};

export const Empty: Story = {
  render: () => (
    <Section id="audit-events" title="최근 기록">
      <AuditTable events={[]} names={{}} />
    </Section>
  ),
};
