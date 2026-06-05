import { currentProfile } from '../test-support/season-participants.spec-fixtures.js';
import { validateSeasonProfileCompleteness } from './season-profile-completeness.policy.js';

describe('season-profile-completeness.policy', () => {
  it('registration completeness는 lifestyle/condition과 season additional을 보고 intro를 blocker로 보지 않는다', () => {
    expect(validateSeasonProfileCompleteness(currentProfile()).complete).toBe(true);
    expect(validateSeasonProfileCompleteness(currentProfile({ intro: '   ' })).complete).toBe(true);
    expect(
      validateSeasonProfileCompleteness(
        currentProfile({ lifestyle: { ...currentProfile().lifestyle, drinkingTolerance: null } }),
      ).complete,
    ).toBe(false);
    expect(validateSeasonProfileCompleteness(currentProfile({ grade: null })).complete).toBe(false);
    expect(validateSeasonProfileCompleteness(currentProfile({ mbti: null })).complete).toBe(false);
    expect(validateSeasonProfileCompleteness(null).complete).toBe(false);
  });
});
