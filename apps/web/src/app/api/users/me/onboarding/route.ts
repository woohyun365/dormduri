import {
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
} from '@repo/shared/user';
import type { NextRequest } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';
import { buildSafeBffErrorResponse } from '@/app/api/_bff/security';

const UPSTREAM_CURRENT_USER_ONBOARDING_PATH = '/api/users/me/onboarding';

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);
  }

  const parsedBody = dismissCurrentUserOnboardingNoticeRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);
  }

  return forwardValidatedBffRequest({
    request,
    method: 'PATCH',
    path: UPSTREAM_CURRENT_USER_ONBOARDING_PATH,
    operation: 'user.onboarding.dismiss',
    authenticated: true,
    bodyMode: 'json',
    body: JSON.stringify(parsedBody.data),
    responseSchema: currentUserResponseSchema,
  });
}
