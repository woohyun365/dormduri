import {
  SERVICE_INTRO_NOTICE_KEY,
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
  updateCurrentUserRequestSchema,
  updateCurrentUserResponseSchema,
} from '@repo/shared/user';
import {
  displayIdentityEditUnavailableReasonSchema,
  userDisplayIdentitySchema,
} from '@repo/shared/user/identity/display';
import { userAcademicIdentitySchema } from '@repo/shared/user/identity/academic';
import {
  accountIdentityIncompleteErrorSchema,
  accountIdentitySchema,
} from '@repo/shared/user/identity/account';

const COMPLETION_READY = {
  profileCompletionRequired: false,
  dormitorySelectionRequired: false,
  registrationUnavailable: false,
  registrationUnavailableReasons: [],
} as const;

describe('user reference contract', () => {
  it('account identity contract는 display identity와 academic identity를 전용 contract에서 소유한다', () => {
    expect(
      userDisplayIdentitySchema.parse({
        userId: 'user-1',
        nickname: '테스터',
        nicknameSource: 'USER_DISPLAY_IDENTITY',
        nicknameChangedAt: null,
      }),
    ).toMatchObject({ nicknameSource: 'USER_DISPLAY_IDENTITY' });
    expect(displayIdentityEditUnavailableReasonSchema.parse('NICKNAME_COOLDOWN_ACTIVE')).toBe(
      'NICKNAME_COOLDOWN_ACTIVE',
    );

    expect(
      userAcademicIdentitySchema.parse({
        collegeCode: 'IT',
        birthYear: 2002,
      }),
    ).toEqual({ collegeCode: 'IT', birthYear: 2002 });

    expect(
      accountIdentitySchema.parse({
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
      }),
    ).toMatchObject({
      displayIdentity: { nickname: '테스터' },
      academicIdentity: { collegeCode: 'IT' },
    });
    expect(
      accountIdentityIncompleteErrorSchema.parse({
        code: 'ACCOUNT_IDENTITY_INCOMPLETE',
        error: '계정 identity가 완성되지 않았습니다.',
        invariant: 'USER_DISPLAY_IDENTITY_REQUIRED',
        context: 'current-user',
      }),
    ).toMatchObject({ invariant: 'USER_DISPLAY_IDENTITY_REQUIRED' });
  });

  it('current-user contract는 registration 준비 UI의 display/academic identity 표시 source를 표현한다', () => {
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
          hasCurrentSeason: true,
          hasParticipantRow: true,
          intent: 'UNDECIDED',
          registered: false,
          profileExists: true,
          profileState: 'COMPLETE',
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: true,
            registrationUnavailable: false,
            registrationUnavailableReasons: [],
          },
          draftWritable: true,
          canSelectDormitory: true,
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
          canEnterRoommateSearch: true,
          canCreateOrUpdateSeasonProfileDraft: true,
          canSelectDormitory: true,
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
              dismissed: true,
              dismissedAt: '2026-05-20T00:00:00.000Z',
            },
          ],
        },
        serviceState: {
          campusOperated: true,
          seasonState: 'SEASON_OPEN',
        },
      }),
    ).toMatchObject({
      displayIdentity: { nicknameSource: 'USER_DISPLAY_IDENTITY' },
      seasonProfile: { profileState: 'COMPLETE' },
      onboarding: { dismissedNotices: [{ dismissed: true }] },
    });
  });

  it('onboarding dismiss request는 service-intro notice key만 허용하고 이전 onboarding key를 거부한다', () => {
    expect(
      dismissCurrentUserOnboardingNoticeRequestSchema.parse({
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
      }),
    ).toEqual({ noticeKey: SERVICE_INTRO_NOTICE_KEY });

    expect(
      dismissCurrentUserOnboardingNoticeRequestSchema.safeParse({
        noticeKey: 'season-profile-onboarding',
      }).success,
    ).toBe(false);
  });

  it('user update request는 display identity와 account academic identity 변경만 받고 selection/message/season profile write를 분리한다', () => {
    expect(
      updateCurrentUserRequestSchema.parse({
        displayIdentity: { nickname: '새닉네임' },
      }),
    ).toMatchObject({ displayIdentity: { nickname: '새닉네임' } });
    expect(
      updateCurrentUserRequestSchema.parse({
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      }),
    ).toMatchObject({
      academicIdentity: {
        collegeCode: 'NURSING',
        birthYear: 2001,
      },
    });

    expect(
      updateCurrentUserRequestSchema.safeParse({
        selection: { state: 'ASSIGNED', dormitoryId: 'dasan' },
      }).success,
    ).toBe(false);
    expect(updateCurrentUserRequestSchema.safeParse({ intro: '시즌 프로필 소개' }).success).toBe(
      false,
    );
    expect(updateCurrentUserRequestSchema.safeParse({ unsupportedUserPatch: true }).success).toBe(
      false,
    );

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
            collegeCode: 'NURSING',
            birthYear: 2001,
          },
          seasonProfile: {
            hasCurrentSeason: true,
            hasParticipantRow: true,
            intent: 'UNDECIDED',
            registered: false,
            profileExists: true,
            profileState: 'COMPLETE',
            completion: COMPLETION_READY,
            draftWritable: true,
            canSelectDormitory: true,
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
            canEnterRoommateSearch: true,
            canCreateOrUpdateSeasonProfileDraft: true,
            canSelectDormitory: true,
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
            dismissedNotices: [],
          },
          serviceState: {
            campusOperated: true,
            seasonState: 'SEASON_OPEN',
          },
        },
        mutation: {
          displayIdentity: {
            attempted: true,
            changed: false,
            noOpReason: 'SAME_NICKNAME',
          },
          academicIdentity: {
            attempted: false,
            changed: false,
            noOpReason: null,
          },
        },
      }).mutation,
    ).toMatchObject({
      displayIdentity: {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_NICKNAME',
      },
      academicIdentity: {
        attempted: false,
        changed: false,
        noOpReason: null,
      },
    });
  });
});
