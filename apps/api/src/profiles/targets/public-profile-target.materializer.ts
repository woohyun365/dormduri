import type { PublicProfile } from '@repo/shared/profile/contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { BlockVisibilityReaderPort } from '../../social-safety/blocks/application/ports/block-visibility-reader.port.js';
import { resolveProfileDisplayName } from '../../privacy/deidentification/deidentified-display.policy.js';
import type { MatchActiveViewPort } from '../../matches/application/ports/match-active-view.port.js';
import type { MatchScoreProjectionPort } from '../../matches/application/ports/match-score-projection.port.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantProfileRecord,
} from '../../season-participants/participants/season-participant-records.js';
import type { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
} from '../../season-participants/public-target-policy/index.js';
import { resolvePublicTargetPolicy } from '../../season-participants/public-target-policy/index.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import {
  parseLifestyleOrNull,
  toPublicProfile,
  toTombstonePublicProfile,
  type ProfileViewRecord,
} from '../contracts/public-profile.presenter.js';
import {
  createProfileDetailEntryTokenCodec,
  type ProfileDetailEntryTokenPayload,
} from '../details/profile-detail-entry-token.codec.js';
import {
  canRenderTombstoneDetail,
  resolveProfileDetailTombstoneReason,
} from '../details/profile-detail-tombstone.policy.js';
import { createPublicProfileViewerContextQuery } from './public-profile-viewer-context.query.js';
import type {
  ActiveMatchByParticipantIdMap,
  PublicProfileTargetCandidate,
  PublicProfileViewerContext,
  ResolvedPublicProfileEntry,
  TargetParticipantQueryRecord,
} from './public-profile-target.types.js';

interface PublicProfileTargetMaterializerDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  seasonParticipantsService: SeasonParticipantsService;
  matchActiveView: MatchActiveViewPort;
  matchScoreProjection: MatchScoreProjectionPort;
  blockVisibilityReader: BlockVisibilityReaderPort;
}

const targetParticipantSelect = {
  ...currentSeasonParticipantSelect,
  user: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
} as const;

export function createPublicProfileTargetMaterializer(deps: PublicProfileTargetMaterializerDeps) {
  const viewerContextQuery = createPublicProfileViewerContextQuery(deps);
  const tokenCodec = createProfileDetailEntryTokenCodec();

  function resolveVisibleProfileEntry(
    candidate: PublicProfileTargetCandidate,
    viewerContext: PublicProfileViewerContext,
    viewerActiveMatch: Awaited<
      ReturnType<MatchActiveViewPort['getCurrentActiveMatchByParticipantId']>
    >,
    activeMatchMap: ActiveMatchByParticipantIdMap,
    registrationSnapshotParticipantIds: ReadonlySet<string>,
  ): ResolvedPublicProfileEntry | null {
    const targetParticipant = candidate.participant;
    const sourceProfile = toProfileViewRecord(targetParticipant.profile ?? null);
    if (!sourceProfile || candidate.user.deletedAt) {
      return null;
    }

    const targetSelection =
      deps.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
    const targetActiveMatch = activeMatchMap.get(targetParticipant.id) ?? null;
    const publicTargetPolicy = resolvePublicTargetPolicy(
      buildPublicTargetPolicyViewerInput({
        campusOperated: viewerContext.serviceState.campusOperated,
        seasonState: viewerContext.serviceState.seasonState,
        participant: viewerContext.viewerParticipant,
        matched: viewerActiveMatch !== null,
        seasonProfileComplete: viewerContext.viewerSeasonProfileComplete,
        matchedPartnerParticipantId: viewerActiveMatch?.counterpartParticipantId ?? null,
        selection: viewerContext.viewerSelection,
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        currentDormitoryCanMatch: viewerContext.currentDormitoryCanMatch,
      }),
      buildPublicTargetPolicyTargetInput({
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        participant: targetParticipant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
        registrationSnapshotExists: registrationSnapshotParticipantIds.has(targetParticipant.id),
        deletedOrDeidentified: candidate.user.deletedAt !== null,
      }),
    );

    if (!publicTargetPolicy.exposure.listSummaryVisible) {
      return null;
    }

    const targetLifestyle = parseLifestyleOrNull(sourceProfile.lifestyle);
    const scoreVisible = deps.matchScoreProjection.shouldExposePublicMatchScore({
      seasonState: viewerContext.serviceState.seasonState,
      scoreVisible: publicTargetPolicy.exposure.scoreVisible,
      resultReadContext: publicTargetPolicy.resultRead.context,
    });
    const matchScore = scoreVisible
      ? deps.matchScoreProjection.calculateQueryTimeRoommateSearchScore({
          viewerLifestyle: viewerContext.viewerLifestyle,
          targetLifestyle,
          scoreVisible,
        })
      : null;

    return {
      user: candidate.user,
      targetParticipant,
      targetDormitoryId: targetSelection.dormitoryId,
      sourceProfile,
      publicTargetPolicy: {
        ...publicTargetPolicy,
        exposure: {
          ...publicTargetPolicy.exposure,
          scoreVisible,
        },
      },
      matchScore,
      viewerMatched: viewerActiveMatch !== null,
      targetMatched: targetActiveMatch !== null,
    };
  }

  async function materializeVisibleProfileEntries(
    viewerContext: PublicProfileViewerContext,
    candidates: PublicProfileTargetCandidate[],
  ): Promise<ResolvedPublicProfileEntry[]> {
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      ...candidates.map((candidate) => candidate.participant.id),
    ].filter((participantId): participantId is string => participantId !== null);
    const registrationSnapshotParticipantIds =
      await deps.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet(
        candidates.map((candidate) => candidate.participant.id),
      );

    const activeMatchMap = viewerContext.currentSeasonId
      ? await deps.matchActiveView.getLiveActiveMatchMapForParticipantIds(
          viewerContext.currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchActiveViewPort['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerContext.viewerParticipant
      ? (activeMatchMap.get(viewerContext.viewerParticipant.id) ?? null)
      : null;

    return candidates
      .map((candidate) =>
        resolveVisibleProfileEntry(
          candidate,
          viewerContext,
          viewerActiveMatch,
          activeMatchMap,
          registrationSnapshotParticipantIds,
        ),
      )
      .filter((entry): entry is ResolvedPublicProfileEntry => entry !== null)
      .sort((left, right) =>
        left.sourceProfile.nickname.localeCompare(right.sourceProfile.nickname, 'ko'),
      );
  }

  function mapTargetParticipantCandidate(
    record: TargetParticipantQueryRecord,
  ): PublicProfileTargetCandidate {
    const { user, ...participant } = record;

    return {
      user,
      participant: mapCurrentSeasonParticipantRecord(
        participant as Parameters<typeof mapCurrentSeasonParticipantRecord>[0],
      ),
    };
  }

  async function getResolvedProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<ResolvedPublicProfileEntry | null> {
    const viewerContext = await viewerContextQuery.loadViewerContext(authUser, now);
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.serviceState.campusOperated ||
      viewerContext.serviceState.seasonState === null ||
      viewerContext.serviceState.seasonState === 'OFF_SEASON'
    ) {
      return null;
    }

    const rawParticipant = await deps.prisma.seasonParticipant.findFirst({
      where: {
        seasonId: viewerContext.currentSeasonId,
        userId: targetUserId,
        user: {
          campus: viewerContext.viewer.campus,
          gender: viewerContext.viewer.gender,
          deletedAt: null,
        },
      },
      select: targetParticipantSelect,
    });
    if (!rawParticipant) {
      return null;
    }

    const [entry] = await materializeVisibleProfileEntries(viewerContext, [
      mapTargetParticipantCandidate(rawParticipant as unknown as TargetParticipantQueryRecord),
    ]);
    return entry ?? null;
  }

  function toDetailPublicProfile(entry: ResolvedPublicProfileEntry): PublicProfile | null {
    return toPublicProfile(
      {
        id: entry.user.id,
        gender: entry.targetParticipant.genderSnapshot,
        campus: entry.targetParticipant.campusCodeSnapshot,
      },
      entry.sourceProfile,
      {
        relation: { type: entry.publicTargetPolicy.relation.relationToViewer },
        actions: entry.publicTargetPolicy.actions,
        resultRead: entry.publicTargetPolicy.resultRead,
        scoreVisible: entry.publicTargetPolicy.exposure.scoreVisible,
        ...(typeof entry.matchScore === 'number' ? { matchScore: entry.matchScore } : {}),
      },
    );
  }

  async function getDetailProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
    options: { detailEntryToken?: string } = {},
  ): Promise<PublicProfile | null> {
    const detailEntryContext = options.detailEntryToken
      ? tokenCodec.verify({
          token: options.detailEntryToken,
          viewerUserId: authUser.id,
          targetUserId,
          now,
        })?.payload
      : null;
    if (options.detailEntryToken && !detailEntryContext) {
      return null;
    }

    const viewerContext = await viewerContextQuery.loadViewerContext(authUser, now);
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.serviceState.campusOperated ||
      viewerContext.serviceState.seasonState === null ||
      viewerContext.serviceState.seasonState === 'OFF_SEASON'
    ) {
      return null;
    }

    const rawParticipant = await deps.prisma.seasonParticipant.findFirst({
      where: {
        seasonId: viewerContext.currentSeasonId,
        userId: targetUserId,
        user: {
          campus: viewerContext.viewer.campus,
          gender: viewerContext.viewer.gender,
        },
      },
      select: targetParticipantSelect,
    });
    if (!rawParticipant) {
      return null;
    }

    return resolveTargetDetailProfile(
      viewerContext,
      mapTargetParticipantCandidate(rawParticipant as unknown as TargetParticipantQueryRecord),
      detailEntryContext,
    );
  }

  async function resolveTargetDetailProfile(
    viewerContext: PublicProfileViewerContext,
    candidate: PublicProfileTargetCandidate,
    detailEntryContext: ProfileDetailEntryTokenPayload | null = null,
  ): Promise<PublicProfile | null> {
    if (await hasActiveBlockBetweenUsers(viewerContext.viewer.id, candidate.user.id)) {
      return null;
    }

    if (detailEntryContext) {
      if (
        detailEntryContext.seasonId !== viewerContext.currentSeasonId ||
        detailEntryContext.targetParticipantId !== candidate.participant.id
      ) {
        return null;
      }
    }

    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      candidate.participant.id,
    ].filter((participantId): participantId is string => participantId !== null);
    const [registrationSnapshotParticipantIds, activeMatchMap] = await Promise.all([
      deps.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet([
        candidate.participant.id,
      ]),
      viewerContext.currentSeasonId
        ? deps.matchActiveView.getLiveActiveMatchMapForParticipantIds(
            viewerContext.currentSeasonId,
            participantIds,
          )
        : Promise.resolve(
            new Map<
              string,
              Awaited<ReturnType<MatchActiveViewPort['getCurrentActiveMatchByParticipantId']>>
            >(),
          ),
    ]);
    const viewerActiveMatch = viewerContext.viewerParticipant
      ? (activeMatchMap.get(viewerContext.viewerParticipant.id) ?? null)
      : null;
    const targetActiveMatch = activeMatchMap.get(candidate.participant.id) ?? null;
    const targetSelection = deps.seasonParticipantsService.selectCanonicalSelection(
      candidate.participant,
    );
    const sourceProfile = toProfileViewRecord(candidate.participant.profile ?? null);
    const publicTargetPolicy = resolvePublicTargetPolicy(
      buildPublicTargetPolicyViewerInput({
        campusOperated: viewerContext.serviceState.campusOperated,
        seasonState: viewerContext.serviceState.seasonState,
        participant: viewerContext.viewerParticipant,
        matched: viewerActiveMatch !== null,
        seasonProfileComplete: viewerContext.viewerSeasonProfileComplete,
        matchedPartnerParticipantId: viewerActiveMatch?.counterpartParticipantId ?? null,
        selection: viewerContext.viewerSelection,
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        currentDormitoryCanMatch: viewerContext.currentDormitoryCanMatch,
      }),
      buildPublicTargetPolicyTargetInput({
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        participant: candidate.participant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
        registrationSnapshotExists: registrationSnapshotParticipantIds.has(
          candidate.participant.id,
        ),
        deletedOrDeidentified: candidate.user.deletedAt !== null,
      }),
    );

    const hasDetailEntryContext = detailEntryContext !== null;
    const hasResultReadContext = publicTargetPolicy.relation.relationToViewer === 'MATCHED_PARTNER';

    if (
      sourceProfile &&
      publicTargetPolicy.exposure.canViewFull &&
      (hasDetailEntryContext || hasResultReadContext)
    ) {
      const targetLifestyle = parseLifestyleOrNull(sourceProfile.lifestyle);
      const scoreVisible = deps.matchScoreProjection.shouldExposePublicMatchScore({
        seasonState: viewerContext.serviceState.seasonState,
        scoreVisible: publicTargetPolicy.exposure.scoreVisible,
        resultReadContext: publicTargetPolicy.resultRead.context,
      });
      const matchScore = scoreVisible
        ? deps.matchScoreProjection.calculateQueryTimeRoommateSearchScore({
            viewerLifestyle: viewerContext.viewerLifestyle,
            targetLifestyle,
            scoreVisible,
          })
        : null;
      const compatibility =
        typeof matchScore === 'number'
          ? deps.matchScoreProjection.buildPublicProfileCompatibility({
              viewerLifestyle: viewerContext.viewerLifestyle,
              targetLifestyle,
              scoreVisible,
            })
          : null;

      return toPublicProfile(
        {
          id: candidate.user.id,
          gender: candidate.participant.genderSnapshot,
          campus: candidate.participant.campusCodeSnapshot,
        },
        sourceProfile,
        {
          relation: { type: publicTargetPolicy.relation.relationToViewer },
          actions: publicTargetPolicy.actions,
          resultRead: publicTargetPolicy.resultRead,
          scoreVisible,
          ...(typeof matchScore === 'number' ? { matchScore } : {}),
          ...(compatibility ? { compatibility } : {}),
        },
      );
    }

    if (!canRenderTombstoneDetail(viewerContext, publicTargetPolicy, hasDetailEntryContext)) {
      return null;
    }

    return toTombstonePublicProfile(candidate.user.id, {
      reason: resolveProfileDetailTombstoneReason(
        candidate,
        sourceProfile,
        publicTargetPolicy.eligibility.unavailableReason,
        viewerContext,
        targetSelection,
        hasDetailEntryContext,
      ),
      displayName: resolveProfileDisplayName({
        deletedAt: candidate.user.deletedAt,
        displayName: sourceProfile?.nickname,
      }),
      relation: { type: publicTargetPolicy.relation.relationToViewer },
      actions: publicTargetPolicy.actions,
      resultRead: publicTargetPolicy.resultRead,
      listSummaryVisible: publicTargetPolicy.exposure.listSummaryVisible,
    });
  }

  async function hasActiveBlockBetweenUsers(viewerUserId: string, targetUserId: string) {
    const excludedTargetUserIds = await deps.blockVisibilityReader.getExcludedTargetUserIds({
      viewerUserId,
      targetUserIds: [targetUserId],
    });

    return excludedTargetUserIds.has(targetUserId);
  }

  return {
    loadViewerContext: viewerContextQuery.loadViewerContext,
    materializeVisibleProfileEntries,
    mapTargetParticipantCandidate,
    getResolvedProfileByUserId,
    getDetailProfileByUserId,
    toDetailPublicProfile,
  };
}

function toProfileViewRecord(
  profile: CurrentSeasonParticipantProfileRecord | null,
): ProfileViewRecord | null {
  if (!profile) {
    return null;
  }

  return {
    nickname: profile.nicknameSnapshot,
    nicknameNormalized: profile.nicknameNormalizedSnapshot,
    lifestyle: profile.lifestyle,
    intro: profile.intro,
    collegeCode: profile.collegeCode,
    grade: profile.grade,
    mbti: profile.mbti,
    birthYear: profile.birthYear,
  };
}
