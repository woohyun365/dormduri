import { accountListResponseSchema } from '@repo/shared/backoffice';
import { AccountsScreen } from '@/screens/accounts/AccountsScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function AccountsPage() {
  const { session } = await requireFullSession();
  if (!hasPermission(session, 'admin:account:invite')) {
    return <Forbidden title="운영자 계정" />;
  }
  const accounts = await readBackoffice('/accounts', accountListResponseSchema);
  if (accounts.kind === 'forbidden') {
    return <Forbidden title="운영자 계정" />;
  }
  return (
    <AccountsScreen
      data={accounts.data}
      selfAccountId={session.account.id}
      canDeactivate={hasPermission(session, 'admin:account:deactivate')}
    />
  );
}
