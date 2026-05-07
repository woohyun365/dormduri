import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
  resolvePublicExposure,
  resolveCurrentUserProfileSource,
} from './season-participant-policy.js';

describe('season-participant-policy', () => {
  it('등록+미배정 매칭 사용자는 LIMITED browse만 유지하고 action capability는 닫힌다', () => {
    const result = buildCurrentUserCapabilities({
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
      participantRegistered: true,
      participantMatched: false,
      selectionState: 'UNASSIGNED',
      hasOperatedAssignedDormitory: false,
      nicknameLockedBySeason: true,
      nicknameCooldownActive: false,
      hasSelectableDormitories: true,
      currentDormitoryCanMatch: false,
    });

    expect(result).toMatchObject({
      canBrowseProfiles: true,
      canRegisterParticipation: false,
      canSelectDormitory: true,
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      profileEdit: {
        intro: false,
        messageToRoommate: true,
        additional: true,
        lifestyle: false,
        nickname: false,
      },
    });
  });

  it('등록+배정 오픈 사용자는 chat만 열리고 match는 닫힌다', () => {
    const result = buildCurrentUserCapabilities({
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      participantRegistered: true,
      participantMatched: false,
      selectionState: 'ASSIGNED',
      hasOperatedAssignedDormitory: true,
      nicknameLockedBySeason: true,
      nicknameCooldownActive: false,
      hasSelectableDormitories: true,
      currentDormitoryCanMatch: false,
    });

    expect(result.canBookmark).toBe(true);
    expect(result.canStartChat).toBe(true);
    expect(result.canRequestMatch).toBe(false);
  });

  it('operated dormitory가 0개면 SEASON_MATCHING action capability를 열지 않는다', () => {
    const result = buildCurrentUserCapabilities({
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      participantRegistered: true,
      participantMatched: false,
      selectionState: 'ASSIGNED',
      hasOperatedAssignedDormitory: false,
      nicknameLockedBySeason: true,
      nicknameCooldownActive: false,
      hasSelectableDormitories: false,
      currentDormitoryCanMatch: false,
    });

    expect(result.canSelectDormitory).toBe(false);
    expect(result.canBookmark).toBe(false);
    expect(result.canStartChat).toBe(false);
    expect(result.canRequestMatch).toBe(false);
  });

  it('현재 시즌 등록 target만 LIMITED/FULL 노출 대상으로 본다', () => {
    const hiddenTarget = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_MATCHING',
        registered: false,
        matched: false,
        matchedPartnerParticipantId: null,
        selectionState: 'UNASSIGNED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
        currentDormitoryCanMatch: false,
      },
      {
        participantId: null,
        visible: false,
        registered: false,
        matched: false,
        selectionState: 'NOT_SELECTED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
        hasSeasonProfile: false,
      },
    );

    expect(hiddenTarget.exposureLevel).toBe('NONE');

    const limitedTarget = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_MATCHING',
        registered: true,
        matched: false,
        matchedPartnerParticipantId: null,
        selectionState: 'UNASSIGNED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
        currentDormitoryCanMatch: false,
      },
      {
        participantId: 'target-1',
        visible: true,
        registered: true,
        matched: false,
        selectionState: 'UNASSIGNED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
        hasSeasonProfile: true,
      },
    );

    expect(limitedTarget).toMatchObject({
      exposureLevel: 'LIMITED',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relationToViewer: 'GENERAL',
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    });
  });

  it('같은 건물 등록+배정 매칭 사용자는 FULL + match/chat action을 가진다', () => {
    const fullTarget = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_MATCHING',
        registered: true,
        matched: false,
        matchedPartnerParticipantId: null,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        currentDormitoryCanMatch: true,
      },
      {
        participantId: 'target-1',
        visible: true,
        registered: true,
        matched: false,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        hasSeasonProfile: true,
      },
    );

    expect(fullTarget).toEqual({
      exposureLevel: 'FULL',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relationToViewer: 'GENERAL',
      actions: {
        canBookmark: true,
        canRequestMatch: true,
        canStartChat: true,
      },
    });
  });

  it('matched partner는 FULL read-only result baseline을 가진다', () => {
    const matchedTarget = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_POST_MATCH',
        registered: true,
        matched: true,
        matchedPartnerParticipantId: 'partner-1',
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        currentDormitoryCanMatch: false,
      },
      {
        participantId: 'partner-1',
        visible: true,
        registered: true,
        matched: true,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        hasSeasonProfile: true,
      },
    );

    expect(matchedTarget).toEqual({
      exposureLevel: 'FULL',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relationToViewer: 'MATCHED_PARTNER',
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: false,
      },
    });
  });

  it('등록 여부에 따라 current-user profile source가 갈린다', () => {
    expect(
      resolveCurrentUserProfileSource({
        campusOperated: true,
        seasonState: 'SEASON_OPEN',
        participantRegistered: true,
        participantProfileExists: true,
      }),
    ).toBe('SEASON_PARTICIPANT_PROFILE');

    expect(
      resolveCurrentUserProfileSource({
        campusOperated: true,
        seasonState: 'SEASON_POST_MATCH',
        participantRegistered: true,
        participantProfileExists: true,
      }),
    ).toBe('USER_PROFILE');
  });

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
