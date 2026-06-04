import {
  resolvePublicProfileExposure,
  resolvePublicResultRead,
  resolvePublicTargetActions,
  resolvePublicTargetEligibility,
  resolvePublicTargetPolicy,
  resolvePublicTargetRelation,
} from './index.js';
import type {
  PublicTargetEligibilityDecision,
  PublicTargetPolicyIntermediate,
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy.types.js';

const baseViewer = (
  overrides: Partial<PublicTargetPolicyViewerInput> = {},
): PublicTargetPolicyViewerInput => ({
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
  ...overrides,
});

const baseTarget = (
  overrides: Partial<PublicTargetPolicyTargetInput> = {},
): PublicTargetPolicyTargetInput => ({
  participantId: 'target-1',
  visible: true,
  registered: true,
  matched: false,
  selectionState: 'ASSIGNED',
  dormitoryId: 'dasan',
  hasOperatedAssignedDormitory: true,
  hasSeasonProfile: true,
  seasonProfileComplete: true,
  registrationSnapshotExists: true,
  deletedOrDeidentified: false,
  ...overrides,
});

const publicEligibility: PublicTargetEligibilityDecision = {
  publicTarget: true,
  unavailableReason: null,
};

const baseIntermediate = (
  overrides: Partial<PublicTargetPolicyIntermediate> = {},
): PublicTargetPolicyIntermediate => ({
  viewerRegistrationComplete: true,
  sameDormitory: true,
  matchedPartnerTarget: false,
  matchedPartnerResultReadable: false,
  sameDormitoryDetailViewable: true,
  ...overrides,
});

describe('public-target-policy axis policies', () => {
  describe('public target eligibility', () => {
    it('OFF_SEASON에는 public target 자체를 닫는다', () => {
      expect(
        resolvePublicTargetEligibility(baseViewer({ seasonState: 'OFF_SEASON' }), baseTarget()),
      ).toEqual({ publicTarget: false, unavailableReason: 'OFF_SEASON' });
    });

    it('registration snapshot이 없는 target은 public summary/detail 대상이 아니다', () => {
      expect(
        resolvePublicTargetEligibility(
          baseViewer(),
          baseTarget({ registrationSnapshotExists: false }),
        ),
      ).toEqual({
        publicTarget: false,
        unavailableReason: 'TARGET_REGISTRATION_SNAPSHOT_MISSING',
      });
    });

    it('visible registered target도 profile이 없거나 incomplete하면 profile incomplete reason으로 닫는다', () => {
      for (const target of [
        baseTarget({ hasSeasonProfile: false, seasonProfileComplete: false }),
        baseTarget({ hasSeasonProfile: true, seasonProfileComplete: false }),
      ]) {
        expect(resolvePublicTargetEligibility(baseViewer(), target)).toEqual({
          publicTarget: false,
          unavailableReason: 'TARGET_PROFILE_INCOMPLETE',
        });
      }
    });

    it('registration complete + visible + profile snapshot target만 public target이다', () => {
      expect(resolvePublicTargetEligibility(baseViewer(), baseTarget())).toEqual({
        publicTarget: true,
        unavailableReason: null,
      });
    });
  });

  describe('public target relation', () => {
    it('matched partner participant만 MATCHED_PARTNER relation이 된다', () => {
      expect(
        resolvePublicTargetRelation(
          baseViewer({ matchedPartnerParticipantId: 'target-1' }),
          baseTarget({ participantId: 'target-1' }),
        ),
      ).toEqual({ relationToViewer: 'MATCHED_PARTNER', matchedPartnerParticipantId: 'target-1' });

      expect(resolvePublicTargetRelation(baseViewer(), baseTarget())).toEqual({
        relationToViewer: 'GENERAL',
        matchedPartnerParticipantId: null,
      });
    });
  });

  describe('public profile exposure', () => {
    it('public target이 아니면 list/detail/score exposure를 모두 닫는다', () => {
      expect(
        resolvePublicProfileExposure(
          { publicTarget: false, unavailableReason: 'OFF_SEASON' },
          baseIntermediate(),
        ),
      ).toEqual({
        listSummaryVisible: false,
        detailViewable: false,
        canViewFull: false,
        scoreVisible: false,
      });
    });

    it('summary-only target은 list-summary만 열고 detail/score는 canViewFull에서 파생해 닫는다', () => {
      expect(
        resolvePublicProfileExposure(
          publicEligibility,
          baseIntermediate({ sameDormitoryDetailViewable: false }),
        ),
      ).toEqual({
        listSummaryVisible: true,
        detailViewable: false,
        canViewFull: false,
        scoreVisible: false,
      });
    });

    it('same-dormitory detail 또는 matched result-read target은 full/detail/score exposure를 연다', () => {
      for (const intermediate of [
        baseIntermediate({
          sameDormitoryDetailViewable: true,
          matchedPartnerResultReadable: false,
        }),
        baseIntermediate({
          sameDormitoryDetailViewable: false,
          matchedPartnerResultReadable: true,
        }),
      ]) {
        const result = resolvePublicProfileExposure(publicEligibility, intermediate);

        expect(result).toEqual({
          listSummaryVisible: true,
          detailViewable: true,
          canViewFull: true,
          scoreVisible: true,
        });
        expect(result.detailViewable).toBe(result.canViewFull);
        expect(result.scoreVisible).toBe(result.canViewFull);
      }
    });
  });

  describe('public target action capability', () => {
    it('미등록 viewer는 summary target을 볼 수 있어도 match/chat action reason을 닫는다', () => {
      const result = resolvePublicTargetActions(
        baseViewer({
          registered: false,
          seasonProfileComplete: false,
          selectionState: 'NOT_SELECTED',
          dormitoryId: null,
          hasOperatedAssignedDormitory: false,
        }),
        baseTarget(),
        publicEligibility,
        baseIntermediate({ viewerRegistrationComplete: false, sameDormitoryDetailViewable: false }),
      );

      expect(result).toMatchObject({
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      });
      expect(result.unavailableReasons).toEqual(
        expect.arrayContaining([
          'VIEWER_NOT_REGISTERED',
          'VIEWER_PROFILE_INCOMPLETE',
          'VIEWER_NOT_ASSIGNED',
        ]),
      );
    });

    it('SEASON_MATCHING same-dormitory full target은 request/chat action을 연다', () => {
      expect(
        resolvePublicTargetActions(
          baseViewer({ seasonState: 'SEASON_MATCHING', currentDormitoryCanMatch: true }),
          baseTarget(),
          publicEligibility,
          baseIntermediate({ sameDormitoryDetailViewable: true }),
        ),
      ).toMatchObject({
        canBookmark: true,
        canRequestMatch: true,
        canStartChat: true,
        unavailableReasons: [],
      });
    });

    it('다른 dormitory target은 summary가 보여도 bookmark/match/chat action을 닫는다', () => {
      expect(
        resolvePublicTargetActions(
          baseViewer({ seasonState: 'SEASON_OPEN' }),
          baseTarget({ dormitoryId: 'taegye' }),
          publicEligibility,
          baseIntermediate({ sameDormitory: false, sameDormitoryDetailViewable: false }),
        ),
      ).toMatchObject({
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['DIFFERENT_DORMITORY'],
      });
    });

    it('SEASON_POST_MATCH matched result context는 result-read만 유지하고 신규 action을 닫는다', () => {
      expect(
        resolvePublicTargetActions(
          baseViewer({
            seasonState: 'SEASON_POST_MATCH',
            matched: true,
            matchedPartnerParticipantId: 'target-1',
          }),
          baseTarget({ participantId: 'target-1', matched: true }),
          publicEligibility,
          baseIntermediate({
            matchedPartnerTarget: true,
            matchedPartnerResultReadable: true,
            sameDormitoryDetailViewable: false,
          }),
        ),
      ).toEqual({
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
      });
    });
  });

  describe('public result-read context', () => {
    it('matched partner readable intermediate만 CURRENT_MATCHED_PARTNER context를 연다', () => {
      expect(
        resolvePublicResultRead(
          publicEligibility,
          baseIntermediate({ matchedPartnerResultReadable: true }),
        ),
      ).toEqual({ resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' });

      expect(resolvePublicResultRead(publicEligibility, baseIntermediate())).toEqual({
        resultReadable: false,
        context: 'NONE',
      });
    });
  });
});

describe('public-target-policy orchestrator', () => {
  it('미등록 사용자는 시즌 중 browse는 가능하지만 detail/score/action capability는 닫힌다', () => {
    const result = resolvePublicTargetPolicy(
      baseViewer({
        seasonState: 'SEASON_MATCHING',
        registered: false,
        seasonProfileComplete: false,
        selectionState: 'NOT_SELECTED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
      }),
      baseTarget(),
    );

    expect(result).toMatchObject({
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      eligibility: { publicTarget: true, unavailableReason: null },
      relation: { relationToViewer: 'GENERAL', matchedPartnerParticipantId: null },
      exposure: {
        listSummaryVisible: true,
        detailViewable: false,
        canViewFull: false,
        scoreVisible: false,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
      resultRead: { resultReadable: false, context: 'NONE' },
    });
  });

  it('같은 건물 등록 완료 viewer는 detail/score를 열고 phase별 action capability를 분리한다', () => {
    expect(
      resolvePublicTargetPolicy(baseViewer({ seasonState: 'SEASON_OPEN' }), baseTarget()),
    ).toMatchObject({
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      relation: { relationToViewer: 'GENERAL' },
      actions: {
        canBookmark: true,
        canRequestMatch: false,
        canStartChat: true,
      },
    });

    expect(
      resolvePublicTargetPolicy(
        baseViewer({ seasonState: 'SEASON_MATCHING', currentDormitoryCanMatch: true }),
        baseTarget(),
      ).actions,
    ).toMatchObject({
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
    });
  });

  it('matched partner는 post-match에서도 detail/score result-read context를 유지한다', () => {
    expect(
      resolvePublicTargetPolicy(
        baseViewer({
          seasonState: 'SEASON_POST_MATCH',
          matched: true,
          matchedPartnerParticipantId: 'partner-1',
        }),
        baseTarget({ participantId: 'partner-1', matched: true }),
      ),
    ).toEqual({
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      eligibility: { publicTarget: true, unavailableReason: null },
      relation: {
        relationToViewer: 'MATCHED_PARTNER',
        matchedPartnerParticipantId: 'partner-1',
      },
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
        unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
      },
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
    });
  });
});
