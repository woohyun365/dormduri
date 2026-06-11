import { resolvePublicTargetPolicy } from './public-target-policy.js';
import type {
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
