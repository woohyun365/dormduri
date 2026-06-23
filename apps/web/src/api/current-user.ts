import {
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
  type CurrentUserResponse,
  type DismissCurrentUserOnboardingNoticeRequest,
} from '@repo/shared/user';

export class CurrentUserMutationError extends Error {
  constructor(
    public readonly code:
      | 'CURRENT_USER_REQUEST_INVALID'
      | 'CURRENT_USER_UPSTREAM_UNAVAILABLE'
      | 'CURRENT_USER_UPSTREAM_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'CurrentUserMutationError';
  }
}

async function readCurrentUserJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new CurrentUserMutationError(
      'CURRENT_USER_UPSTREAM_INVALID',
      'Current user response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new CurrentUserMutationError(
      'CURRENT_USER_UPSTREAM_INVALID',
      'Current user response JSON is malformed.',
    );
  }
}

async function dismissOnboardingNotice(
  input: DismissCurrentUserOnboardingNoticeRequest,
): Promise<CurrentUserResponse> {
  const parsedInput = dismissCurrentUserOnboardingNoticeRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new CurrentUserMutationError(
      'CURRENT_USER_REQUEST_INVALID',
      'Onboarding notice request is invalid.',
    );
  }

  let response: Response;
  try {
    response = await fetch('/api/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsedInput.data),
      cache: 'no-store',
    });
  } catch {
    throw new CurrentUserMutationError(
      'CURRENT_USER_UPSTREAM_UNAVAILABLE',
      'Current user onboarding request failed.',
    );
  }

  if (!response.ok) {
    throw new CurrentUserMutationError(
      'CURRENT_USER_UPSTREAM_UNAVAILABLE',
      'Current user onboarding upstream returned an error status.',
    );
  }

  const parsedResponse = currentUserResponseSchema.safeParse(await readCurrentUserJson(response));
  if (!parsedResponse.success) {
    throw new CurrentUserMutationError(
      'CURRENT_USER_UPSTREAM_INVALID',
      'Current user response did not match the public contract.',
    );
  }

  return parsedResponse.data;
}

export const currentUserApi = {
  dismissOnboardingNotice,
};
