import {
  accessRequestListQuerySchema,
  accessRequestListResponseSchema,
} from '@repo/shared/backoffice';
import { HomeDashboard, type PendingRequests } from '@/screens/home/HomeDashboard';
import { readBackoffice } from '@/server/backoffice-read';
import { toSearchParams } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';

export default async function HomePage() {
  const { session } = await requireFullSession();
  // Only an approver has pending requests to decide: the first page of them (the API's default page size) gives the
  // count, and a next page says there are more (design plan D-OD8, no new API).
  let pending: PendingRequests = null;
  if (hasPermission(session, 'admin:access:approve')) {
    const read = await readBackoffice(
      '/access/requests',
      accessRequestListResponseSchema,
      toSearchParams(accessRequestListQuerySchema.parse({ status: 'PENDING' })),
    );
    if (read.kind === 'ok') {
      pending = { count: read.data.requests.length, overflow: read.data.nextPage !== null };
    }
  }
  return <HomeDashboard session={session} pending={pending} />;
}
