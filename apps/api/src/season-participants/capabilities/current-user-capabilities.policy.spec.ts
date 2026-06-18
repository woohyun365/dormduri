import { describe, expect, it } from 'vitest';
import { buildCurrentUserCapabilities } from './current-user-capabilities.policy.js';

describe('current-user-capabilities.policy', () => {
  it('current-user capability는 registration draft/finalize와 public action을 분리한다', () => {
    const draftUser = buildCurrentUserCapabilities({
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      participantRegistered: false,
      participantMatched: false,
      seasonProfileComplete: true,
      selectionState: 'SELECTED',
      hasOperatedAssignedDormitory: false,
      nicknameLockedBySeason: false,
      nicknameCooldownActive: false,
      hasSelectableDormitories: true,
      currentDormitoryCanMatch: false,
    });

    expect(draftUser).toMatchObject({
      canEnterRoommateSearch: true,
      canCreateOrUpdateSeasonProfileDraft: true,
      canSelectDormitory: true,
      canFinalizeSeasonRegistration: true,
      canRequestMatch: false,
      canStartChat: false,
    });

    const registeredUser = buildCurrentUserCapabilities({
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
      participantRegistered: true,
      participantMatched: false,
      seasonProfileComplete: true,
      selectionState: 'ASSIGNED',
      hasOperatedAssignedDormitory: true,
      nicknameLockedBySeason: true,
      nicknameCooldownActive: false,
      hasSelectableDormitories: true,
      currentDormitoryCanMatch: true,
    });

    expect(registeredUser).toMatchObject({
      canCreateOrUpdateSeasonProfileDraft: false,
      canSelectDormitory: false,
      canFinalizeSeasonRegistration: false,
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
    });
  });
});
