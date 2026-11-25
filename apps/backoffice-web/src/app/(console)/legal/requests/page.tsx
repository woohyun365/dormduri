import { notFound } from 'next/navigation';
import {
  accountListResponseSchema,
  legalRequestDetailResponseSchema,
  legalRequestListQuerySchema,
  legalRequestListResponseSchema,
} from '@repo/shared/backoffice';
import { LegalRequestsScreen } from '@/screens/legal/LegalRequestsScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { flatSearchParams, isUuid, toSearchParams } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function LegalRequestsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireFullSession();
  const canEdit = hasPermission(session, 'admin:legal:edit');
  const canApprove = hasPermission(session, 'admin:legal:approve');
  if (!canEdit && !canApprove) {
    return <Forbidden title="게시 요청" />;
  }
  // The chosen request is the page's own query (design guide ④); the rest is the API's list query.
  const { request: chosen, ...listParams } = flatSearchParams(await searchParams);
  if (chosen !== undefined && !isUuid(chosen)) notFound();
  const parsed = legalRequestListQuerySchema.safeParse(listParams);
  const query = parsed.success ? parsed.data : legalRequestListQuerySchema.parse({});
  const [requests, accounts] = await Promise.all([
    readBackoffice('/legal/requests', legalRequestListResponseSchema, toSearchParams(query)),
    hasPermission(session, 'admin:account:invite')
      ? readBackoffice('/accounts', accountListResponseSchema)
      : Promise.resolve(null),
  ]);
  if (requests.kind === 'forbidden') {
    return <Forbidden title="게시 요청" />;
  }
  const selectedId = chosen ?? requests.data.requests[0]?.id;
  const selected = selectedId
    ? await readBackoffice(`/legal/requests/${selectedId}`, legalRequestDetailResponseSchema)
    : null;
  if (selected?.kind === 'forbidden') {
    return <Forbidden title="게시 요청" />;
  }
  return (
    <LegalRequestsScreen
      requests={requests.data.requests}
      selected={selected?.data ?? null}
      accounts={accounts?.kind === 'ok' ? accounts.data.accounts : null}
      selfAccountId={session.account.id}
      canEdit={canEdit}
      canApprove={canApprove}
      status={query.status ?? null}
      nextPage={requests.data.nextPage}
    />
  );
}
