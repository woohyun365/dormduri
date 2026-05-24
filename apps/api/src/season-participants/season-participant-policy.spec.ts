import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
  resolvePublicExposure,
} from './season-participant-policy.js';

describe('season-participant-policy', () => {
  it('미등록 사용자는 시즌 중 browse는 가능하지만 detail/score/action capability는 닫힌다', () => {
    const result = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_MATCHING',
        registered: false,
        matched: false,
        seasonProfileComplete: false,
        matchedPartnerParticipantId: null,
        selectionState: 'NOT_SELECTED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
        currentDormitoryCanMatch: false,
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
        registrationSnapshotExists: true,
      },
    );

    expect(result).toEqual({
      summaryVisible: true,
      detailViewable: false,
      canViewFull: false,
      scoreVisible: false,
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relationToViewer: 'GENERAL',
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    });
  });

  it('OFF_SEASON에는 public browse 자체를 닫는다', () => {
    const result = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'OFF_SEASON',
        registered: true,
        matched: false,
        seasonProfileComplete: true,
        matchedPartnerParticipantId: null,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        currentDormitoryCanMatch: false,
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
        registrationSnapshotExists: true,
      },
    );

    expect(result.summaryVisible).toBe(false);
    expect(result.canViewFull).toBe(false);
    expect(result.scoreVisible).toBe(false);
  });

  it('registration snapshot이 없는 target은 public summary/detail 대상이 아니다', () => {
    const result = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_OPEN',
        registered: true,
        matched: false,
        seasonProfileComplete: true,
        matchedPartnerParticipantId: null,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        currentDormitoryCanMatch: false,
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
        registrationSnapshotExists: false,
      },
    );

    expect(result.summaryVisible).toBe(false);
  });

  it('같은 건물 등록 완료 viewer는 detail/score를 열고 phase별 action capability를 분리한다', () => {
    const openResult = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_OPEN',
        registered: true,
        matched: false,
        seasonProfileComplete: true,
        matchedPartnerParticipantId: null,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        currentDormitoryCanMatch: false,
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
        registrationSnapshotExists: true,
      },
    );

    expect(openResult).toMatchObject({
      summaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: true,
      relationToViewer: 'GENERAL',
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: true,
      },
    });

    const matchingResult = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_MATCHING',
        registered: true,
        matched: false,
        seasonProfileComplete: true,
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
        registrationSnapshotExists: true,
      },
    );

    expect(matchingResult.actions).toEqual({
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
    });
  });

  it('matched partner는 post-match에서도 detail/score read-only capability를 유지한다', () => {
    const result = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_POST_MATCH',
        registered: true,
        matched: true,
        seasonProfileComplete: true,
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
        registrationSnapshotExists: true,
      },
    );

    expect(result).toEqual({
      summaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: true,
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relationToViewer: 'MATCHED_PARTNER',
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: false,
      },
    });
  });

  it('detailViewable과 scoreVisible은 canViewFull 정책 capability에서 파생된다', () => {
    const summaryOnly = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_MATCHING',
        registered: false,
        matched: false,
        seasonProfileComplete: false,
        matchedPartnerParticipantId: null,
        selectionState: 'NOT_SELECTED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
        currentDormitoryCanMatch: false,
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
        registrationSnapshotExists: true,
      },
    );
    const fullView = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: 'SEASON_OPEN',
        registered: true,
        matched: false,
        seasonProfileComplete: true,
        matchedPartnerParticipantId: null,
        selectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        hasOperatedAssignedDormitory: true,
        currentDormitoryCanMatch: false,
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
        registrationSnapshotExists: true,
      },
    );

    for (const result of [summaryOnly, fullView]) {
      expect(result.detailViewable).toBe(result.canViewFull);
      expect(result.scoreVisible).toBe(result.canViewFull);
    }
  });

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
      canBrowseProfiles: true,
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
