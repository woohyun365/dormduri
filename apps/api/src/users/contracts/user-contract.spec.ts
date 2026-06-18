import { describe, expect, it } from 'vitest';
import {
  SERVICE_INTRO_NOTICE_KEY,
  currentUserResponseSchema,
  updateCurrentUserRequestSchema,
  updateCurrentUserResponseSchema,
} from '@repo/shared/user';

describe('users shared contract smoke', () => {
  it('current-user response는 account self-service read model shape를 보존한다', () => {
    expect(
      currentUserResponseSchema.parse({
        user: {
          id: 'user-1',
          email: 'student@kangwon.ac.kr',
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        displayIdentity: {
          userId: 'user-1',
          nickname: '테스터',
          nicknameSource: 'USER_DISPLAY_IDENTITY',
          nicknameChangedAt: null,
        },
        academicIdentity: {
          collegeCode: 'IT',
          birthYear: 2002,
        },
        seasonProfile: {
          hasCurrentSeason: false,
          hasParticipantRow: false,
          intent: 'UNDECIDED',
          registered: false,
          profileExists: false,
          profileState: 'NONE',
          completion: {
            profileCompletionRequired: true,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['NO_CURRENT_SEASON'],
          },
          draftWritable: false,
          canSelectDormitory: false,
          canFinalizeRegistration: false,
        },
        selection: {
          state: 'NOT_SELECTED',
          dormitoryId: null,
          source: 'SEASON_PARTICIPANT',
        },
        match: {
          hasActiveMatch: false,
          activeMatch: null,
        },
        capabilities: {
          canEnterRoommateSearch: false,
          canCreateOrUpdateSeasonProfileDraft: false,
          canSelectDormitory: false,
          canFinalizeSeasonRegistration: false,
          canEditDisplayIdentity: true,
          displayIdentityEditUnavailableReasons: [],
          canEditAcademicIdentity: true,
          academicIdentityEditUnavailableReasons: [],
          canBookmark: false,
          canRequestMatch: false,
          canStartChat: false,
        },
        onboarding: {
          dismissedNotices: [
            {
              noticeKey: SERVICE_INTRO_NOTICE_KEY,
              dismissed: false,
              dismissedAt: null,
            },
          ],
        },
        serviceState: {
          campusOperated: false,
          seasonState: null,
        },
      }),
    ).toMatchObject({
      user: { id: 'user-1' },
      displayIdentity: { nicknameSource: 'USER_DISPLAY_IDENTITY' },
      serviceState: { campusOperated: false },
    });
  });

  it('update request/response는 display identity와 academic identity mutation만 표현한다', () => {
    expect(
      updateCurrentUserRequestSchema.parse({
        displayIdentity: { nickname: '새닉네임' },
      }),
    ).toEqual({ displayIdentity: { nickname: '새닉네임' } });
    expect(
      updateCurrentUserRequestSchema.safeParse({ selection: { dormitoryId: 'dasan' } }).success,
    ).toBe(false);

    expect(
      updateCurrentUserResponseSchema.parse({
        currentUser: {
          user: {
            id: 'user-1',
            email: 'student@kangwon.ac.kr',
            nickname: '테스터',
            gender: 'M',
            campus: 'CHUNCHEON',
          },
          displayIdentity: {
            userId: 'user-1',
            nickname: '테스터',
            nicknameSource: 'USER_DISPLAY_IDENTITY',
            nicknameChangedAt: null,
          },
          academicIdentity: {
            collegeCode: 'IT',
            birthYear: 2002,
          },
          seasonProfile: {
            hasCurrentSeason: false,
            hasParticipantRow: false,
            intent: 'UNDECIDED',
            registered: false,
            profileExists: false,
            profileState: 'NONE',
            completion: {
              profileCompletionRequired: true,
              dormitorySelectionRequired: true,
              registrationUnavailable: true,
              registrationUnavailableReasons: ['NO_CURRENT_SEASON'],
            },
            draftWritable: false,
            canSelectDormitory: false,
            canFinalizeRegistration: false,
          },
          selection: {
            state: 'NOT_SELECTED',
            dormitoryId: null,
            source: 'SEASON_PARTICIPANT',
          },
          match: {
            hasActiveMatch: false,
            activeMatch: null,
          },
          capabilities: {
            canEnterRoommateSearch: false,
            canCreateOrUpdateSeasonProfileDraft: false,
            canSelectDormitory: false,
            canFinalizeSeasonRegistration: false,
            canEditDisplayIdentity: true,
            displayIdentityEditUnavailableReasons: [],
            canEditAcademicIdentity: true,
            academicIdentityEditUnavailableReasons: [],
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
          },
          onboarding: { dismissedNotices: [] },
          serviceState: {
            campusOperated: false,
            seasonState: null,
          },
        },
        mutation: {
          displayIdentity: { attempted: true, changed: false, noOpReason: 'SAME_NICKNAME' },
          academicIdentity: { attempted: false, changed: false, noOpReason: null },
        },
      }).mutation.displayIdentity.noOpReason,
    ).toBe('SAME_NICKNAME');
  });
});
