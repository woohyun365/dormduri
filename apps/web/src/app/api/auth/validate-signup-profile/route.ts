import type { SignupProfileValidationRequest } from '@repo/shared/auth-contract';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '../_shared';

export async function POST(request: Request) {
  const body = (await request.json()) as SignupProfileValidationRequest;
  const { response, json } = await forwardAuthRequest(
    'POST',
    '/auth/validate-signup-profile',
    body,
    {
      headers: getForwardHeaders(request),
    },
  );

  return buildJsonResponse(response, json);
}
