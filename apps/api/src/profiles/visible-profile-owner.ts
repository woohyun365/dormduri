import type { PublicProfile, PublicProfileTombstoneReason } from '@repo/shared/profile-contract';
import { isSeasonProfileComplete, type LifestyleData } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveProfileDisplayName } from '../common/deidentification/deidentified-display.owner.js';
import type { MatchesService } from '../matches/matches.service.js';
import {
  buildDirectionalMatchScoreProjection,
  shouldExposePublicMatchScore,
} from '../matches/match-score-projection.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantProfileRecord,
} from '../season-participants/season-participant-records.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
  isParticipantRegistered,
} from '../season-participants/season-participant-policy.js';
import {
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
} from '../season-participants/season-participant-gate-context.js';
import { resolvePublicTargetPolicy } from '../season-participants/season-participant-policy.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import {
  parseLifestyleOrNull,
  toPublicProfile,
  toTombstonePublicProfile,
  type ProfileViewRecord,
} from './profile.mapper.js';

interface VisibleProfileOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  matchesService: MatchesService;
}

export interface VisibleProfileViewerContext {
  viewer: {
    id: string;
    emailVerifiedAt: Date | null;
    gender: 'M' | 'F';
    campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  };
  viewerParticipant: CurrentSeasonParticipantRecord | null;
  viewerSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
  viewerLifestyle: LifestyleData | null;
  viewerSeasonProfileComplete: boolean;
  viewerHasOperatedAssignedDormitory: boolean;
  currentSeasonId: string | null;
  serviceState: {
    campusOperated: boolean;
    seasonState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null;
  };
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
}

export interface VisibleProfileTargetCandidate {
  user: {
    id: string;
    deletedAt: Date | null;
  };
  participant: CurrentSeasonParticipantRecord;
}

export interface ResolvedVisibleProfileEntry {
  user: VisibleProfileTargetCandidate['user'];
  targetParticipant: CurrentSeasonParticipantRecord;
  targetDormitoryId: string | null;
  sourceProfile: ProfileViewRecord;
  publicTargetPolicy: ReturnType<typeof resolvePublicTargetPolicy>;
  matchScore: number | null;
}

type ActiveMatchByParticipantId = Awaited<
  ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>
>;
type ActiveMatchByParticipantIdMap = Map<string, ActiveMatchByParticipantId>;

const userForProfileVisibilitySelect = {
  id: true,
  emailVerifiedAt: true,
  gender: true,
  campus: true,
  deletedAt: true,
} as const;

const targetParticipantSelect = {
  ...currentSeasonParticipantSelect,
  user: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
} as const;

type TargetParticipantQueryRecord = CurrentSeasonParticipantRecord & {
  user: { id: string; deletedAt: Date | null };
};

export function createVisibleProfileOwner(deps: VisibleProfileOwnerDeps) {
  async function loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
  ): Promise<VisibleProfileViewerContext> {
    const viewer = await deps.prisma.user.findUnique({
      where: { id: authUser.id },
      select: userForProfileVisibilitySelect,
    });
    if (!viewer || viewer.deletedAt) {
      throw new Error('[VisibleProfileOwner] authenticated viewer not found');
    }

    const serviceState = await resolveCampusServiceState(
      deps.prisma,
      deps.seasonsService,
      viewer.campus,
      now,
    );
    const viewerParticipant = await deps.seasonParticipantsService.ensureCurrentSeasonParticipant(
      viewer,
      now,
    );
    const viewerSelection =
      deps.seasonParticipantsService.selectCanonicalSelection(viewerParticipant);
    const operatedDormitoryIds = new Set(
      serviceState.seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? [],
    );
    const viewerLifestyle = parseLifestyleOrNull(viewerParticipant?.profile?.lifestyle ?? null);

    return {
      viewer,
      viewerParticipant,
      viewerSelection,
      viewerLifestyle,
      viewerSeasonProfileComplete:
        viewerLifestyle !== null && isSeasonProfileComplete(viewerLifestyle),
      viewerHasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
        operatedDormitoryIds,
        viewerSelection.dormitorySelectionState,
        viewerSelection.dormitoryId,
      ),
      currentSeasonId: serviceState.seasonContext?.season.id ?? null,
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
      operatedDormitoryIds,
      currentDormitoryCanMatch: canCurrentDormitoryMatch(
        serviceState.seasonContext,
        viewerSelection.dormitoryId,
        now,
      ),
    };
  }

  function resolveVisibleProfileEntry(
    candidate: VisibleProfileTargetCandidate,
    viewerContext: VisibleProfileViewerContext,
    viewerActiveMatch: Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>,
    activeMatchMap: ActiveMatchByParticipantIdMap,
    registrationSnapshotParticipantIds: ReadonlySet<string>,
  ): ResolvedVisibleProfileEntry | null {
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
    const scoreVisible = shouldExposePublicMatchScore({
      seasonState: viewerContext.serviceState.seasonState,
      scoreVisible: publicTargetPolicy.exposure.scoreVisible,
      resultReadContext: publicTargetPolicy.resultRead.context,
    });
    const matchScore = scoreVisible
      ? buildDirectionalMatchScoreProjection(viewerContext.viewerLifestyle, targetLifestyle)
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
    };
  }

  async function materializeVisibleProfileEntries(
    viewerContext: VisibleProfileViewerContext,
    candidates: VisibleProfileTargetCandidate[],
  ): Promise<ResolvedVisibleProfileEntry[]> {
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      ...candidates.map((candidate) => candidate.participant.id),
    ].filter((participantId): participantId is string => participantId !== null);
    const registrationSnapshotParticipantIds =
      await deps.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet(
        candidates.map((candidate) => candidate.participant.id),
      );

    const activeMatchMap = viewerContext.currentSeasonId
      ? await deps.matchesService.getLiveActiveMatchMapForParticipantIds(
          viewerContext.currentSeasonId,
          participantIds,
        )
      : new Map<string, ActiveMatchByParticipantId>();
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
      .filter((entry): entry is ResolvedVisibleProfileEntry => entry !== null)
      .sort((left, right) =>
        left.sourceProfile.nickname.localeCompare(right.sourceProfile.nickname, 'ko'),
      );
  }

  function mapTargetParticipantCandidate(
    record: TargetParticipantQueryRecord,
  ): VisibleProfileTargetCandidate {
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
  ): Promise<ResolvedVisibleProfileEntry | null> {
    const viewerContext = await loadViewerContext(authUser, now);
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

  function toDetailPublicProfile(entry: ResolvedVisibleProfileEntry): PublicProfile | null {
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
  ): Promise<PublicProfile | null> {
    const viewerContext = await loadViewerContext(authUser, now);
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
    );
  }

  async function resolveTargetDetailProfile(
    viewerContext: VisibleProfileViewerContext,
    candidate: VisibleProfileTargetCandidate,
  ): Promise<PublicProfile | null> {
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      candidate.participant.id,
    ].filter((participantId): participantId is string => participantId !== null);
    const [registrationSnapshotParticipantIds, activeMatchMap] = await Promise.all([
      deps.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet([
        candidate.participant.id,
      ]),
      viewerContext.currentSeasonId
        ? deps.matchesService.getLiveActiveMatchMapForParticipantIds(
            viewerContext.currentSeasonId,
            participantIds,
          )
        : Promise.resolve(new Map<string, ActiveMatchByParticipantId>()),
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

    if (sourceProfile && publicTargetPolicy.exposure.canViewFull) {
      const targetLifestyle = parseLifestyleOrNull(sourceProfile.lifestyle);
      const scoreVisible = shouldExposePublicMatchScore({
        seasonState: viewerContext.serviceState.seasonState,
        scoreVisible: publicTargetPolicy.exposure.scoreVisible,
        resultReadContext: publicTargetPolicy.resultRead.context,
      });
      const matchScore = scoreVisible
        ? buildDirectionalMatchScoreProjection(viewerContext.viewerLifestyle, targetLifestyle)
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
        },
      );
    }

    if (!canRenderTombstoneDetail(viewerContext, targetSelection, publicTargetPolicy.relation)) {
      return null;
    }

    return toTombstonePublicProfile(candidate.user.id, {
      reason: resolveProfileDetailTombstoneReason(
        candidate,
        sourceProfile,
        publicTargetPolicy.eligibility.unavailableReason,
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

  return {
    loadViewerContext,
    materializeVisibleProfileEntries,
    mapTargetParticipantCandidate,
    getResolvedProfileByUserId,
    getDetailProfileByUserId,
    toDetailPublicProfile,
  };
}

function canRenderTombstoneDetail(
  viewerContext: VisibleProfileViewerContext,
  targetSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>,
  relation: ReturnType<typeof resolvePublicTargetPolicy>['relation'],
) {
  const viewerHadDetailCapableContext =
    isParticipantRegistered(viewerContext.viewerParticipant) &&
    viewerContext.viewerSeasonProfileComplete &&
    viewerContext.viewerHasOperatedAssignedDormitory;
  if (!viewerHadDetailCapableContext) {
    return false;
  }

  if (relation.relationToViewer === 'MATCHED_PARTNER') {
    return true;
  }

  return (
    viewerContext.viewerSelection.dormitoryId !== null &&
    viewerContext.viewerSelection.dormitoryId === targetSelection.dormitoryId
  );
}

function resolveProfileDetailTombstoneReason(
  candidate: VisibleProfileTargetCandidate,
  sourceProfile: ProfileViewRecord | null,
  eligibilityReason: string | null,
): PublicProfileTombstoneReason {
  if (candidate.user.deletedAt !== null || eligibilityReason === 'TARGET_DELETED_OR_DEIDENTIFIED') {
    return 'TARGET_DELETED_OR_DEIDENTIFIED';
  }
  if (
    candidate.participant.hiddenByAdminAt !== null ||
    candidate.participant.deactivatedAt !== null
  ) {
    return 'SAFETY_OR_VISIBILITY_RESTRICTED';
  }
  if (
    !sourceProfile ||
    eligibilityReason === 'TARGET_PROFILE_INCOMPLETE' ||
    eligibilityReason === 'TARGET_REGISTRATION_SNAPSHOT_MISSING' ||
    eligibilityReason === 'TARGET_NOT_REGISTERED'
  ) {
    return 'PROFILE_NO_LONGER_AVAILABLE';
  }
  return 'DETAIL_ACCESS_REVOKED';
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
