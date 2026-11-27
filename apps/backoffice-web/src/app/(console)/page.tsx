import { HomeDashboard } from '@/screens/home/HomeDashboard';
import { readPendingLegalRequests, readPendingRequests } from '@/server/pending-requests';
import { requireFullSession } from '@/server/session';

export default async function HomePage() {
  const { session } = await requireFullSession();
  const [pending, legalPending] = await Promise.all([
    readPendingRequests(session),
    readPendingLegalRequests(session),
  ]);
  return <HomeDashboard session={session} pending={pending} legalPending={legalPending} />;
}
