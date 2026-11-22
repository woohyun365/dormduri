import Link from 'next/link';
import {
  accountListResponseSchema,
  auditEventListResponseSchema,
  auditEventsQuerySchema,
} from '@repo/shared/backoffice';
import { AuditReviewForm } from '@/screens/audit/AuditReviewForm';
import { AuditTable } from '@/screens/audit/AuditTable';
import { readBackoffice } from '@/server/backoffice-read';
import { flatSearchParams, toSearchParams } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';
import { Section } from '@/ui/forms';

export default async function AuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireFullSession();
  if (!hasPermission(session, 'admin:audit:read')) {
    return <Forbidden />;
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
    return <Forbidden />;
  }
  const names =
    accounts?.kind === 'ok'
      ? Object.fromEntries(
          accounts.data.accounts.map((account) => [account.id, account.displayName]),
        )
      : {};
  const next = events.data.nextPage;
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">감사 기록</h1>
      {hasPermission(session, 'admin:audit:review') ? (
        <Section id="audit-review" title="월 점검 기록">
          <AuditReviewForm />
        </Section>
      ) : null}
      <Section id="audit-events" title="최근 기록">
        <AuditTable events={events.data.events} names={names} />
        <div className="flex gap-4 text-sm">
          {query.beforeTime ? (
            <Link href="/audit" prefetch={false} className="underline">
              처음으로
            </Link>
          ) : null}
          {next ? (
            <Link
              href={{ pathname: '/audit', query: { ...next } }}
              prefetch={false}
              className="underline"
            >
              이전 기록 보기
            </Link>
          ) : null}
        </div>
      </Section>
    </>
  );
}
