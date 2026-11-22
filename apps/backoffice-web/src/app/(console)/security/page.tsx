import { SecurityScreen } from '@/screens/security/SecurityScreen';
import { requireFullSession } from '@/server/session';

export default async function SecurityPage() {
  const { session } = await requireFullSession();
  return (
    <SecurityScreen
      passkeyCount={session.passkeyCount}
      totpConfirmed={session.totpConfirmed}
      recoveryCodesRemaining={session.recoveryCodesRemaining}
    />
  );
}
