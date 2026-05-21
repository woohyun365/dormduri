import type { FullPublicProfile } from '@repo/shared/profile-contract';
import { isSeasonProfileComplete, type LifestyleData } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { MatchesService } from '../matches/matches.service.js';
import {
  buildDirectionalMatchScoreProjection,
  shouldExposePublicMatchScore,
} from '../matches/match-score-projection.js';
import type {
  CanonicalProfileSource,
  CurrentSeasonParticipantRecord,
} from '../season-participants/season-participants.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
  hasParticipantProfile,
  isParticipantRegistered,
  resolveCurrentUserProfileSource,
} from '../season-participants/season-participant-policy.js';
import {
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
} from '../season-participants/season-participant-gate-context.js';
import { resolvePublicExposure } from '../season-participants/season-participant-exposure.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import {
  buildUserWithProfileSelect,
  mapUserWithParticipantProjection,
} from '../users/current-user-select.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import {
  getUserWithProfile,
  type UserWithParticipantProjection,
} from './profiles-owner-support.js';
import { parseLifestyleOrNull, toPublicProfile } from './profile.mapper.js';

interface VisibleProfileOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  matchesService: MatchesService;
}

export interface VisibleProfileViewerContext {
  viewer: UserWithParticipantProjection;
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

export interface ResolvedVisibleProfileEntry {
  user: UserWithParticipantProjection;
  targetParticipant: CurrentSeasonParticipantRecord | null;
  targetDormitoryId: string | null;
  sourceProfile: CanonicalProfileSource;
  exposure: ReturnType<typeof resolvePublicExposure>;
  matchScore: number | null;
}

export function createVisibleProfileOwner(deps: VisibleProfileOwnerDeps) {
  async function loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
  ): Promise<VisibleProfileViewerContext> {
    const viewer = (await getUserWithProfile(
      deps.prisma,
      authUser.id,
    )) as UserWithParticipantProjection;
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

    if (!viewer.profile) {
      throw new Error('[VisibleProfileOwner] authenticated viewer profile is required');
    }

    const viewerProfileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered: isParticipantRegistered(viewerParticipant),
      participantProfileExists: hasParticipantProfile(viewerParticipant),
    });
    const viewerProfile = deps.seasonParticipantsService.selectProfileBySource(
      viewer.profile,
      viewerParticipant?.profile ?? null,
      viewerProfileSource,
    );
    const viewerLifestyle = parseLifestyleOrNull(viewerProfile.lifestyle);

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
    user: UserWithParticipantProjection,
    viewerContext: VisibleProfileViewerContext,
    viewerActiveMatch: Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>,
    activeMatchMap: Map<
      string,
      Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
    >,
  ): ResolvedVisibleProfileEntry | null {
    if (!user.profile) {
      return null;
    }

    const targetParticipant = deps.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const targetSelection =
      deps.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
    const targetActiveMatch = targetParticipant
      ? (activeMatchMap.get(targetParticipant.id) ?? null)
      : null;
    const exposure = resolvePublicExposure(
      buildPublicExposureViewerInput({
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
      buildPublicExposureTargetInput({
        seasonState: viewerContext.serviceState.seasonState,
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        participant: targetParticipant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
      }),
    );

    if (!exposure || exposure.exposureLevel === 'NONE') {
      return null;
    }

    const sourceProfile = deps.seasonParticipantsService.selectProfileBySource(
      user.profile,
      targetParticipant?.profile ?? null,
      exposure.sourceProfile,
    );
    const targetLifestyle = parseLifestyleOrNull(sourceProfile.lifestyle);
    const matchScore = shouldExposePublicMatchScore({
      seasonState: viewerContext.serviceState.seasonState,
      exposureLevel: exposure.exposureLevel,
      relationToViewer: exposure.relationToViewer,
    })
      ? buildDirectionalMatchScoreProjection(viewerContext.viewerLifestyle, targetLifestyle)
      : null;

    return {
      user,
      targetParticipant,
      targetDormitoryId: targetSelection.dormitoryId,
      sourceProfile,
      exposure,
      matchScore,
    };
  }

  async function materializeVisibleProfileEntries(
    viewerContext: VisibleProfileViewerContext,
    users: UserWithParticipantProjection[],
  ): Promise<ResolvedVisibleProfileEntry[]> {
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      ...users.map(
        (user) =>
          deps.seasonParticipantsService.pickCurrentSeasonParticipant(user.seasonParticipants)
            ?.id ?? null,
      ),
    ].filter((participantId): participantId is string => participantId !== null);

    const activeMatchMap = viewerContext.currentSeasonId
      ? await deps.matchesService.getLiveActiveMatchMapForParticipantIds(
          viewerContext.currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerContext.viewerParticipant
      ? (activeMatchMap.get(viewerContext.viewerParticipant.id) ?? null)
      : null;

    return users
      .map((user) =>
        resolveVisibleProfileEntry(user, viewerContext, viewerActiveMatch, activeMatchMap),
      )
      .filter((entry): entry is ResolvedVisibleProfileEntry => entry !== null)
      .sort((left, right) =>
        left.sourceProfile.nickname.localeCompare(right.sourceProfile.nickname, 'ko'),
      );
  }

  async function getResolvedProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<ResolvedVisibleProfileEntry | null> {
    const viewerContext = await loadViewerContext(authUser, now);
    const rawUser = await deps.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        ...buildUserWithProfileSelect(viewerContext.currentSeasonId),
        deletedAt: true,
      },
    });
    if (!rawUser || rawUser.deletedAt) {
      return null;
    }

    const user = mapUserWithParticipantProjection(rawUser);
    const [entry] = await materializeVisibleProfileEntries(viewerContext, [user]);
    return entry ?? null;
  }

  function toFullPublicProfile(entry: ResolvedVisibleProfileEntry): FullPublicProfile | null {
    if (entry.exposure.exposureLevel !== 'FULL') {
      return null;
    }

    return toPublicProfile(entry.user, entry.sourceProfile, {
      exposureLevel: 'FULL',
      sourceProfile: entry.exposure.sourceProfile,
      relationToViewer: entry.exposure.relationToViewer,
      actions: entry.exposure.actions,
      ...(typeof entry.matchScore === 'number' ? { matchScore: entry.matchScore } : {}),
    }) as FullPublicProfile;
  }

  async function getFullProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<FullPublicProfile | null> {
    const entry = await getResolvedProfileByUserId(authUser, targetUserId, now);
    if (!entry) {
      return null;
    }

    return toFullPublicProfile(entry);
  }

  return {
    loadViewerContext,
    materializeVisibleProfileEntries,
    getResolvedProfileByUserId,
    getFullProfileByUserId,
    toFullPublicProfile,
  };
}
