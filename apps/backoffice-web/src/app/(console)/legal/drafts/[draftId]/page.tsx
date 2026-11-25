import { notFound } from 'next/navigation';
import { accountListResponseSchema, legalDraftDetailResponseSchema } from '@repo/shared/backoffice';
import { LegalDraftEditor } from '@/screens/legal/LegalDraftEditor';
import { readBackoffice, readBackofficeTarget } from '@/server/backoffice-read';
import { isUuid } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function LegalDraftPage({
  params,
}: {
  readonly params: Promise<{ draftId: string }>;
}) {
  const { session } = await requireFullSession();
  if (
    !hasPermission(session, 'admin:legal:edit') &&
    !hasPermission(session, 'admin:legal:approve')
  ) {
    return <Forbidden title="초안 편집" />;
  }
  const { draftId } = await params;
  if (!isUuid(draftId)) notFound();
  const [detail, accounts] = await Promise.all([
    readBackofficeTarget(`/legal/drafts/${draftId}`, legalDraftDetailResponseSchema),
    hasPermission(session, 'admin:account:invite')
      ? readBackoffice('/accounts', accountListResponseSchema)
      : Promise.resolve(null),
  ]);
  if (detail.kind === 'forbidden') {
    return <Forbidden title="초안 편집" />;
  }
  return (
    <LegalDraftEditor
      key={detail.data.draft.id}
      detail={detail.data}
      accounts={accounts?.kind === 'ok' ? accounts.data.accounts : null}
      canEdit={hasPermission(session, 'admin:legal:edit')}
    />
  );
}
