import {
  currentParticipant,
  currentProfile,
  participant,
} from '../test-support/season-participants.spec-fixtures.js';
import { resolveSeasonProfileState } from './season-profile-draft.mapper.js';

describe('season-profile-draft.mapper', () => {
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
});
