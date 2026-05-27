import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
} from './season-participant-policy.js';

describe('season-participant current-user capability policy', () => {
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

describe('season-participant dormitory/matching gate helpers', () => {
  it('운영 기숙사 배정 여부는 시즌 운영 목록 기준으로 판단한다', () => {
    expect(hasOperatedAssignedDormitory(new Set(['dasan', 'taegye']), 'ASSIGNED', 'dasan')).toBe(
      true,
    );
    expect(hasOperatedAssignedDormitory(new Set(['dasan']), 'ASSIGNED', 'other-dorm')).toBe(false);
    expect(hasOperatedAssignedDormitory(new Set(['dasan']), 'UNASSIGNED', 'dasan')).toBe(false);
  });

  it('현재 기숙사 매칭 가능 여부는 season state + matching window를 함께 본다', () => {
    const seasonContext: Parameters<typeof canCurrentDormitoryMatch>[0] = {
      state: 'SEASON_MATCHING',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'taegye', isOperated: true, roomSelectionDate: '2026-02-15' },
      ],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-15',
        seasonEnd: '2026-02-28',
      },
    };

    expect(canCurrentDormitoryMatch(seasonContext, 'dasan', new Date('2026-02-10T03:00:00Z'))).toBe(
      true,
    );
    expect(canCurrentDormitoryMatch(seasonContext, 'dasan', new Date('2026-02-12T03:00:00Z'))).toBe(
      false,
    );
    expect(
      canCurrentDormitoryMatch(
        {
          state: 'SEASON_POST_MATCH',
          operatedDormitories: seasonContext.operatedDormitories,
          schedule: seasonContext.schedule,
        },
        'dasan',
        new Date('2026-02-10T03:00:00Z'),
      ),
    ).toBe(false);
  });
});
