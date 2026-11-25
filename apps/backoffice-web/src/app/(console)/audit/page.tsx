import {
  accountListResponseSchema,
  auditEventListResponseSchema,
  auditEventsQuerySchema,
} from '@repo/shared/backoffice';
import { AuditScreen } from '@/screens/audit/AuditScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { flatSearchParams, toSearchParams } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function AuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireFullSession();
  if (!hasPermission(session, 'admin:audit:read')) {
    return <Forbidden title="감사 기록" />;
  }
  const parsed = auditEventsQuerySchema.safeParse(flatSearchParams(await searchParams));
  const query = parsed.success ? parsed.data : auditEventsQuerySchema.parse({});
  const [events, accounts] = await Promise.all([
    readBackoffice('/audit/events', auditEventListResponseSchema, toSearchParams(query)),
    // An auditor reads who did what by account id; only the owner role maps ids to names.
    hasPermission(session, 'admin:account:invite')
      ? readBackoffice('/accounts', accountListResponseSchema)
      : Promise.resolve(null),
  ]);
  if (events.kind === 'forbidden') {
    return <Forbidden title="감사 기록" />;
  }
  const names =
    accounts?.kind === 'ok'
      ? Object.fromEntries(
          accounts.data.accounts.map((account) => [account.id, account.displayName]),
        )
      : {};
  return (
    <AuditScreen
      events={events.data.events}
      names={names}
      canReview={hasPermission(session, 'admin:audit:review')}
      nextPage={events.data.nextPage}
      laterPage={Boolean(query.beforeTime)}
    />
  );
}
