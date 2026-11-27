import {
  accountListResponseSchema,
  legalDraftListQuerySchema,
  legalDraftListResponseSchema,
} from '@repo/shared/backoffice';
import { LegalDraftsScreen } from '@/screens/legal/LegalDraftsScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { flatSearchParams, toSearchParams } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function LegalDraftsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireFullSession();
  if (
    !hasPermission(session, 'admin:legal:edit') &&
    !hasPermission(session, 'admin:legal:approve')
  ) {
    return <Forbidden title="초안" />;
  }
  const parsed = legalDraftListQuerySchema.safeParse(flatSearchParams(await searchParams));
  const query = parsed.success ? parsed.data : legalDraftListQuerySchema.parse({});
  const [drafts, accounts] = await Promise.all([
    readBackoffice('/legal/drafts', legalDraftListResponseSchema, toSearchParams(query)),
    // Names come with the account list, which needs the owner role; others see account ids (README §4).
    hasPermission(session, 'admin:account:invite')
      ? readBackoffice('/accounts', accountListResponseSchema)
      : Promise.resolve(null),
  ]);
  if (drafts.kind === 'forbidden') {
    return <Forbidden title="초안" />;
  }
  return (
    <LegalDraftsScreen
      drafts={drafts.data.drafts}
      accounts={accounts?.kind === 'ok' ? accounts.data.accounts : null}
      canEdit={hasPermission(session, 'admin:legal:edit')}
      kind={query.kind ?? null}
      status={query.status ?? null}
      nextPage={drafts.data.nextPage}
    />
  );
}
