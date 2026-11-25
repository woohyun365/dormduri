import { HomeDashboard } from '@/screens/home/HomeDashboard';
import { readPendingRequests } from '@/server/pending-requests';
import { requireFullSession } from '@/server/session';

export default async function HomePage() {
  const { session } = await requireFullSession();
  return <HomeDashboard session={session} pending={await readPendingRequests(session)} />;
}
