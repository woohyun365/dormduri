import { buildCompletion } from './season-participation-capability.owner.js';

describe('season-participation-capability.owner', () => {
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
