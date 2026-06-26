import { afterEach, describe, expect, it, vi } from 'vitest';
import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user';
import {
  homeOnboardingNoticeApi,
  HomeOnboardingNoticeMutationError,
} from '../home-onboarding-notice.api';

function makeCurrentUserResponse(): CurrentUserResponse {
  return {
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
}

function stubFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': contentType },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('homeOnboardingNoticeApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('service-intro notice dismiss 전용 method만 노출한다', () => {
    expect(Object.keys(homeOnboardingNoticeApi)).toEqual(['dismissServiceIntroNotice']);
  });

  it('dismissServiceIntroNotice는 same-origin BFF PATCH와 shared request contract를 사용한다', async () => {
    const currentUser = makeCurrentUserResponse();
    const fetchMock = stubFetch(currentUser);

    await expect(homeOnboardingNoticeApi.dismissServiceIntroNotice()).resolves.toEqual(currentUser);

    expect(fetchMock).toHaveBeenCalledWith('/api/users/me/onboarding', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ noticeKey: SERVICE_INTRO_NOTICE_KEY }),
      cache: 'no-store',
    });
  });

  it('응답 schema drift를 Home onboarding notice mutation error로 변환한다', async () => {
    stubFetch({ onboarding: { dismissedNotices: [{ dismissed: true }] } });

    await expect(homeOnboardingNoticeApi.dismissServiceIntroNotice()).rejects.toMatchObject({
      name: 'HomeOnboardingNoticeMutationError',
      code: 'HOME_ONBOARDING_NOTICE_UPSTREAM_INVALID',
    });
  });

  it('네트워크 실패를 Home onboarding notice mutation error로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    await expect(homeOnboardingNoticeApi.dismissServiceIntroNotice()).rejects.toBeInstanceOf(
      HomeOnboardingNoticeMutationError,
    );
    await expect(homeOnboardingNoticeApi.dismissServiceIntroNotice()).rejects.toMatchObject({
      code: 'HOME_ONBOARDING_NOTICE_UPSTREAM_UNAVAILABLE',
    });
  });
});
