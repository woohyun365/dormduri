import { afterEach, describe, expect, it, vi } from 'vitest';
import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user';
import { createBffRequest, firstFetchInit, firstFetchInput, stubJsonFetch } from '@/test/bff-route';
import { PATCH } from './route';

const AUTH_TOKEN = `v1.session-user.${'a'.repeat(43)}`;

function makeCurrentUserResponse(
  overrides: Partial<CurrentUserResponse> = {},
): CurrentUserResponse {
  const base: CurrentUserResponse = {
    user: {
      id: 'user-1',
      email: 'user@kangwon.ac.kr',
      nickname: '춘천유저',
      gender: 'M',
      campus: 'CHUNCHEON',
    },
    displayIdentity: {
      userId: 'user-1',
      nickname: '춘천유저',
      nicknameSource: 'USER_DISPLAY_IDENTITY',
      nicknameChangedAt: null,
    },
    academicIdentity: {
      collegeCode: 'IT',
      birthYear: 2004,
    },
    seasonProfile: {
      hasCurrentSeason: true,
      hasParticipantRow: true,
      intent: 'REGISTERED',
      registered: true,
      profileExists: true,
      profileState: 'REGISTRATION_FINALIZED',
      completion: {
        profileCompletionRequired: false,
        dormitorySelectionRequired: false,
        registrationUnavailable: false,
        registrationUnavailableReasons: [],
      },
      draftWritable: false,
      canSelectDormitory: false,
      canFinalizeRegistration: false,
    },
    selection: {
      state: 'ASSIGNED',
      dormitoryId: 'dasan',
      source: 'SEASON_PARTICIPANT',
    },
    match: {
      hasActiveMatch: false,
      activeMatch: null,
    },
    capabilities: {
      canEnterRoommateSearch: true,
      canCreateOrUpdateSeasonProfileDraft: false,
      canSelectDormitory: false,
      canFinalizeSeasonRegistration: false,
      canEditDisplayIdentity: true,
      displayIdentityEditUnavailableReasons: [],
      canEditAcademicIdentity: true,
      academicIdentityEditUnavailableReasons: [],
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
    },
    onboarding: {
      dismissedNotices: [
        {
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissed: true,
          dismissedAt: '2026-06-23T00:00:00.000Z',
        },
      ],
    },
    serviceState: {
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
    },
  };

  return { ...base, ...overrides };
}

function createPatchRequest(body: unknown) {
  return createBffRequest('/api/users/me/onboarding', {
    method: 'PATCH',
    headers: {
      Cookie: `auth-token=${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.30',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  });
}

describe('current-user onboarding BFF route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('service-intro dismiss request를 cookie 인증과 함께 upstream PATCH로 전달한다', async () => {
    const currentUser = makeCurrentUserResponse();
    const fetchMock = stubJsonFetch(currentUser);

    const response = await PATCH(createPatchRequest({ noticeKey: SERVICE_INTRO_NOTICE_KEY }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(currentUser);
    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/users/me/onboarding');
    expect(firstFetchInit(fetchMock)).toMatchObject({
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.30',
        'user-agent': 'vitest',
      },
      body: JSON.stringify({ noticeKey: SERVICE_INTRO_NOTICE_KEY }),
    });
  });

  it('허용되지 않은 onboarding key는 upstream 호출 전에 fail-closed한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await PATCH(createPatchRequest({ noticeKey: 'season-profile-onboarding' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_REQUEST_BODY_INVALID',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upstream current-user response가 contract와 다르면 safe error로 변환한다', async () => {
    stubJsonFetch({ onboarding: { dismissedNotices: [{ dismissed: true }] } });

    const response = await PATCH(createPatchRequest({ noticeKey: SERVICE_INTRO_NOTICE_KEY }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('upstream error JSON은 status를 유지하되 민감 필드를 제거한다', async () => {
    stubJsonFetch(
      {
        success: false,
        code: 'AUTH_REQUIRED',
        accessToken: 'must-not-leak',
      },
      401,
    );

    const response = await PATCH(createPatchRequest({ noticeKey: SERVICE_INTRO_NOTICE_KEY }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_REQUIRED',
    });
  });
});
