import {
  accessRequestListQuerySchema,
  accessRequestListResponseSchema,
  accountListResponseSchema,
  roleCatalogResponseSchema,
} from '@repo/shared/backoffice';
import { AccessScreen } from '@/screens/access/AccessScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { flatSearchParams, toSearchParams } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function AccessPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireFullSession();
  const canRequest = hasPermission(session, 'admin:access:request');
  const canApprove = hasPermission(session, 'admin:access:approve');
  if (!canRequest && !canApprove) {
    return <Forbidden />;
  }
  const parsed = accessRequestListQuerySchema.safeParse(flatSearchParams(await searchParams));
  const query = parsed.success ? parsed.data : accessRequestListQuerySchema.parse({});
  const [requests, roles, accounts] = await Promise.all([
    readBackoffice('/access/requests', accessRequestListResponseSchema, toSearchParams(query)),
    readBackoffice('/access/roles', roleCatalogResponseSchema),
    // Names come with the account list, which needs the owner role; others see account ids (README §4).
    hasPermission(session, 'admin:account:invite')
      ? readBackoffice('/accounts', accountListResponseSchema)
      : Promise.resolve(null),
  ]);
  if (requests.kind === 'forbidden' || roles.kind === 'forbidden') {
    return <Forbidden />;
  }
  return (
    <AccessScreen
      requests={requests.data.requests}
      roles={roles.data.roles}
      accounts={accounts?.kind === 'ok' ? accounts.data.accounts : null}
      selfAccountId={session.account.id}
      canRequest={canRequest}
      canApprove={canApprove}
      status={query.status ?? null}
      nextPage={requests.data.nextPage}
    />
  );
}
