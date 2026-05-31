import type { PublicProfile, PublicProfileTombstoneReason } from '@repo/shared/profile-contract';
import { isSeasonProfileComplete, type LifestyleData } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveProfileDisplayName } from '../common/deidentification/deidentified-display.owner.js';
import type { MatchesService } from '../matches/matches.service.js';
import { shouldExposePublicMatchScore } from '../matches/match-score-projection.js';
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
import { calculateQueryTimeRoommateSearchScore } from './roommate-search-score.owner.js';
import {
  createRoommateSearchTokenOwner,
  type ProfileDetailEntryTokenPayload,
} from './roommate-search-token-owner.js';

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
  seasonReferenceYear: number | null;
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
  viewerMatched: boolean;
  targetMatched: boolean;
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
  const tokenOwner = createRoommateSearchTokenOwner();

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
      seasonReferenceYear: resolveSeasonReferenceYear(
        serviceState.seasonContext?.season.seasonEndDate,
      ),
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
      ? calculateQueryTimeRoommateSearchScore({
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
    options: { detailEntryToken?: string } = {},
  ): Promise<PublicProfile | null> {
    const detailEntryContext = options.detailEntryToken
      ? tokenOwner.verifyDetailEntryToken({
          token: options.detailEntryToken,
          viewerUserId: authUser.id,
          targetUserId,
          now,
        })?.payload
      : null;
    if (options.detailEntryToken && !detailEntryContext) {
      return null;
    }

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
      detailEntryContext,
    );
  }

  async function resolveTargetDetailProfile(
    viewerContext: VisibleProfileViewerContext,
    candidate: VisibleProfileTargetCandidate,
    detailEntryContext: ProfileDetailEntryTokenPayload | null = null,
  ): Promise<PublicProfile | null> {
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

    const hasDetailEntryContext = detailEntryContext !== null;
    const hasResultReadContext = publicTargetPolicy.relation.relationToViewer === 'MATCHED_PARTNER';

    if (
      sourceProfile &&
      publicTargetPolicy.exposure.canViewFull &&
      (hasDetailEntryContext || hasResultReadContext)
    ) {
      const targetLifestyle = parseLifestyleOrNull(sourceProfile.lifestyle);
      const scoreVisible = shouldExposePublicMatchScore({
        seasonState: viewerContext.serviceState.seasonState,
        scoreVisible: publicTargetPolicy.exposure.scoreVisible,
        resultReadContext: publicTargetPolicy.resultRead.context,
      });
      const matchScore = scoreVisible
        ? calculateQueryTimeRoommateSearchScore({
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

  return {
    loadViewerContext,
    materializeVisibleProfileEntries,
    mapTargetParticipantCandidate,
    getResolvedProfileByUserId,
    getDetailProfileByUserId,
    toDetailPublicProfile,
  };
}

function resolveSeasonReferenceYear(seasonEndDate: string | null | undefined) {
  if (!seasonEndDate) {
    return null;
  }

  const parsed = Number(seasonEndDate.slice(0, 4));
  return Number.isInteger(parsed) ? parsed : null;
}

function canRenderTombstoneDetail(
  viewerContext: VisibleProfileViewerContext,
  publicTargetPolicy: ReturnType<typeof resolvePublicTargetPolicy>,
  hasDetailEntryContext: boolean,
) {
  if (publicTargetPolicy.relation.relationToViewer === 'MATCHED_PARTNER') {
    return true;
  }

  if (!hasDetailEntryContext) {
    return false;
  }

  return viewerContext.serviceState.seasonState !== null;
}

function resolveProfileDetailTombstoneReason(
  candidate: VisibleProfileTargetCandidate,
  sourceProfile: ProfileViewRecord | null,
  eligibilityReason: string | null,
  viewerContext: VisibleProfileViewerContext,
  targetSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>,
  hasDetailEntryContext: boolean,
): PublicProfileTombstoneReason {
  if (!hasDetailEntryContext) {
    return 'DETAIL_CONTEXT_NO_LONGER_VALID';
  }

  if (
    candidate.user.deletedAt !== null ||
    eligibilityReason === 'TARGET_DELETED_OR_DEIDENTIFIED' ||
    candidate.participant.hiddenByAdminAt !== null ||
    candidate.participant.deactivatedAt !== null ||
    candidate.participant.participantStatus === 'WITHDRAWN' ||
    candidate.participant.participantStatus === 'EXPIRED' ||
    !sourceProfile ||
    eligibilityReason === 'TARGET_PROFILE_INCOMPLETE' ||
    eligibilityReason === 'TARGET_REGISTRATION_SNAPSHOT_MISSING' ||
    eligibilityReason === 'TARGET_NOT_REGISTERED'
  ) {
    return 'TARGET_NO_LONGER_DISCOVERABLE';
  }

  if (!isParticipantRegistered(viewerContext.viewerParticipant)) {
    return 'DETAIL_REQUIRES_REGISTRATION';
  }

  if (!viewerContext.viewerHasOperatedAssignedDormitory) {
    return 'DETAIL_REQUIRES_ASSIGNED_DORMITORY';
  }

  if (
    viewerContext.viewerSelection.dormitoryId !== null &&
    targetSelection.dormitoryId !== null &&
    viewerContext.viewerSelection.dormitoryId !== targetSelection.dormitoryId
  ) {
    return 'DETAIL_NOT_AVAILABLE_DIFFERENT_DORMITORY';
  }

  return 'DETAIL_CONTEXT_NO_LONGER_VALID';
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
