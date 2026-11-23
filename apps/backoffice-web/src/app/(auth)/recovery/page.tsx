import { RecoveryScreen } from '@/screens/recovery/RecoveryScreen';
import { requireRecoverySession } from '@/server/session';

export default async function RecoveryPage() {
  const { session } = await requireRecoverySession();
  return <RecoveryScreen displayName={session.account.displayName} />;
}
