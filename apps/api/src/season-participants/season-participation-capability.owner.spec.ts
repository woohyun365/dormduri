import {
  buildCompletion,
  resolveSeasonProfileState,
  validateSeasonProfileCompleteness,
} from './season-participation-capability.owner.js';
import {
  currentParticipant,
  currentProfile,
  participant,
} from './season-participants.owner.spec-fixtures.js';

describe('season-participation-capability.owner', () => {
  it('profile completeness는 lifestyle 필수값과 intro를 함께 본다', () => {
    expect(validateSeasonProfileCompleteness(currentProfile()).complete).toBe(true);
    expect(validateSeasonProfileCompleteness(currentProfile({ intro: '   ' })).complete).toBe(
      false,
    );
    expect(
      validateSeasonProfileCompleteness(
        currentProfile({ lifestyle: { ...currentProfile().lifestyle, drinkingTolerance: null } }),
      ).complete,
    ).toBe(false);
    expect(validateSeasonProfileCompleteness(null).complete).toBe(false);
  });

  it('profileState는 없음/draft/complete/finalized를 registration 상태와 completeness 기준으로 계산한다', () => {
    expect(resolveSeasonProfileState(null)).toBe('NONE');
    expect(
      resolveSeasonProfileState(
        currentParticipant({
          profile: currentProfile({
            lifestyle: { ...currentProfile().lifestyle, drinkingTolerance: null },
          }),
        }) as never,
      ),
    ).toBe('DRAFT');
    expect(
      resolveSeasonProfileState(currentParticipant({ profile: currentProfile() }) as never),
    ).toBe('COMPLETE');
    expect(
      resolveSeasonProfileState(
        participant({
          participationIntent: 'REGISTERED',
          registeredAt: new Date('2026-02-10T03:00:00.000Z'),
          dormitorySelectionState: 'ASSIGNED',
          dormitoryId: 'dasan',
          participantStatus: 'ACTIVE',
          profile: currentProfile(),
        }) as never,
      ),
    ).toBe('REGISTRATION_FINALIZED');
  });

  it('buildCompletion은 block reason과 required flags를 한 곳에서 계산한다', () => {
    const completion = buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase: true,
      profileComplete: false,
      dormitorySelectionReady: false,
      participantRegistrationLocked: false,
      accountOrParticipantInactive: false,
      hasSelectableDormitories: false,
      roomSelectionClosed: true,
    });

    expect(completion).toMatchObject({
      profileCompletionRequired: true,
      dormitorySelectionRequired: true,
      registrationUnavailable: true,
    });
    expect(completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining([
        'PROFILE_INCOMPLETE',
        'DORMITORY_SELECTION_REQUIRED',
        'NO_SELECTABLE_DORMITORY',
        'DORMITORY_SELECTION_CLOSED',
      ]),
    );
  });
});
