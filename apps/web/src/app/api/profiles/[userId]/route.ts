import { publicProfileSchema } from '@repo/shared/profile/contract';
import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardValidatedBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type ProfileRouteContext = BffRouteContext<{ userId: string }>;

export async function GET(request: NextRequest, context: ProfileRouteContext) {
  const { userId } = await resolveBffRouteParams(context);
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: `/api/profiles/${encodeBffPathSegment(userId)}${request.nextUrl.search}`,
    operation: 'profile.public_detail',
    authenticated: true,
    responseSchema: publicProfileSchema,
  });
}
