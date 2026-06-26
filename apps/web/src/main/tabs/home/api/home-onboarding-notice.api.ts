import {
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
  SERVICE_INTRO_NOTICE_KEY,
  type CurrentUserResponse,
} from '@repo/shared/user';

export class HomeOnboardingNoticeMutationError extends Error {
  constructor(
    public readonly code:
      | 'HOME_ONBOARDING_NOTICE_REQUEST_INVALID'
      | 'HOME_ONBOARDING_NOTICE_UPSTREAM_UNAVAILABLE'
      | 'HOME_ONBOARDING_NOTICE_UPSTREAM_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'HomeOnboardingNoticeMutationError';
  }
}

async function readCurrentUserJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new HomeOnboardingNoticeMutationError(
      'HOME_ONBOARDING_NOTICE_UPSTREAM_INVALID',
      'Home onboarding notice response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new HomeOnboardingNoticeMutationError(
      'HOME_ONBOARDING_NOTICE_UPSTREAM_INVALID',
      'Home onboarding notice response JSON is malformed.',
    );
  }
}

async function dismissServiceIntroNotice(): Promise<CurrentUserResponse> {
  const input = { noticeKey: SERVICE_INTRO_NOTICE_KEY };
  const parsedInput = dismissCurrentUserOnboardingNoticeRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new HomeOnboardingNoticeMutationError(
      'HOME_ONBOARDING_NOTICE_REQUEST_INVALID',
      'Home service intro notice request is invalid.',
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
    throw new HomeOnboardingNoticeMutationError(
      'HOME_ONBOARDING_NOTICE_UPSTREAM_UNAVAILABLE',
      'Home onboarding notice request failed.',
    );
  }

  if (!response.ok) {
    throw new HomeOnboardingNoticeMutationError(
      'HOME_ONBOARDING_NOTICE_UPSTREAM_UNAVAILABLE',
      'Home onboarding notice upstream returned an error status.',
    );
  }

  const parsedResponse = currentUserResponseSchema.safeParse(await readCurrentUserJson(response));
  if (!parsedResponse.success) {
    throw new HomeOnboardingNoticeMutationError(
      'HOME_ONBOARDING_NOTICE_UPSTREAM_INVALID',
      'Home onboarding notice response did not match the public contract.',
    );
  }

  return parsedResponse.data;
}

export const homeOnboardingNoticeApi = {
  dismissServiceIntroNotice,
};
