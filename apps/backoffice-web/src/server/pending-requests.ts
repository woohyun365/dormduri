import 'server-only';
import {
  accessRequestListQuerySchema,
  accessRequestListResponseSchema,
  legalRequestListQuerySchema,
  legalRequestListResponseSchema,
  type SessionInfoResponse,
} from '@repo/shared/backoffice';
import type { PendingRequests } from '@/screens/home/HomeDashboard';
import { readBackoffice } from './backoffice-read';
import { toSearchParams } from './page-query';
import { BackofficeUnavailableError, hasPermission } from './session';

/**
 * The home's pending access requests (design guide ④ dashboard, no new API). Only an approver has them to decide: the
 * first page of them (the API's default page size) gives the count, and a next page says there are more. A refusal or
 * a read the home cannot use leaves the line saying so, and the rest of the home and the console stay; an ended
 * session still goes to the login as every page read does (README §1).
 */
export async function readPendingRequests(session: SessionInfoResponse): Promise<PendingRequests> {
  if (!hasPermission(session, 'admin:access:approve')) return null;
  try {
    const read = await readBackoffice(
      '/access/requests',
      accessRequestListResponseSchema,
      toSearchParams(accessRequestListQuerySchema.parse({ status: 'PENDING' })),
    );
    if (read.kind === 'forbidden') return 'unavailable';
    return { count: read.data.requests.length, overflow: read.data.nextPage !== null };
  } catch (error) {
    if (error instanceof BackofficeUnavailableError) return 'unavailable';
    throw error;
  }
}

/**
 * The home's pending legal publish and withdraw requests, read the same way for an approver of them
 * (`admin:legal:approve`, which the owner role also holds).
 */
export async function readPendingLegalRequests(
  session: SessionInfoResponse,
): Promise<PendingRequests> {
  if (!hasPermission(session, 'admin:legal:approve')) return null;
  try {
    const read = await readBackoffice(
      '/legal/requests',
      legalRequestListResponseSchema,
      toSearchParams(legalRequestListQuerySchema.parse({ status: 'PENDING' })),
    );
    if (read.kind === 'forbidden') return 'unavailable';
    return { count: read.data.requests.length, overflow: read.data.nextPage !== null };
  } catch (error) {
    if (error instanceof BackofficeUnavailableError) return 'unavailable';
    throw error;
  }
}
