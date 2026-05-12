import type { PublicProfile } from '@repo/shared/profile-contract';
import {
  isSeasonProfileComplete,
  lifestyleSchema,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { MatchesService } from '../matches/matches.service.js';
import {
  buildDirectionalMatchScoreProjection,
  shouldExposePublicMatchScore,
} from '../matches/match-score-projection.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  hasParticipantProfile,
  isParticipantRegistered,
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
  resolveCurrentUserProfileSource,
} from '../season-participants/season-participant-policy.js';
import {
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
} from '../season-participants/season-participant-gate-context.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import {
  buildUserWithProfileSelect,
  mapUserWithParticipantProjection,
} from '../users/current-user-select.js';
import { toPublicProfile } from './profile.mapper.js';
import { resolveProfileExposure } from './profile-visibility.js';
import {
  getUserWithProfile,
  type UserWithParticipantProjection,
} from './profiles-owner-support.js';

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

export interface VisiblePublicProfileEntry {
  profile: PublicProfile;
  nickname: string;
  targetDormitoryId: string | null;
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
    const viewerParticipant =
      await deps.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(viewer, now);
    const viewerSelection = deps.seasonParticipantsService.selectCanonicalSelection(
      viewer,
      viewerParticipant,
    );
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
    const parsedViewerLifestyle = lifestyleSchema.safeParse(viewerProfile.lifestyle);

    return {
      viewer,
      viewerParticipant,
      viewerSelection,
      viewerLifestyle: parsedViewerLifestyle.success ? parsedViewerLifestyle.data : null,
      viewerSeasonProfileComplete:
        parsedViewerLifestyle.success && isSeasonProfileComplete(parsedViewerLifestyle.data),
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

  function toVisiblePublicProfileEntry(
    user: UserWithParticipantProjection,
    viewerContext: VisibleProfileViewerContext,
    viewerActiveMatch: Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>,
    activeMatchMap: Map<
      string,
      Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
    >,
  ): VisiblePublicProfileEntry | null {
    if (!user.profile) {
      return null;
    }

    const targetParticipant = deps.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const targetSelection = deps.seasonParticipantsService.selectCanonicalSelection(
      user,
      targetParticipant,
    );
    const targetActiveMatch = targetParticipant
      ? (activeMatchMap.get(targetParticipant.id) ?? null)
      : null;
    const exposure = resolveProfileExposure({
      viewer: buildPublicExposureViewerInput({
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
      target: buildPublicExposureTargetInput({
        seasonState: viewerContext.serviceState.seasonState,
        operatedDormitoryIds: viewerContext.operatedDormitoryIds,
        participant: targetParticipant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
      }),
    });

    if (!exposure) {
      return null;
    }

    const sourceProfile = deps.seasonParticipantsService.selectProfileBySource(
      user.profile,
      targetParticipant?.profile ?? null,
      exposure.sourceProfile,
    );
    const parsedTargetLifestyle = lifestyleSchema.safeParse(sourceProfile.lifestyle);
    const scoreProjection = shouldExposePublicMatchScore({
      seasonState: viewerContext.serviceState.seasonState,
      exposureLevel: exposure.exposureLevel,
      relationToViewer: exposure.relationToViewer,
    })
      ? buildDirectionalMatchScoreProjection(
          viewerContext.viewerLifestyle,
          parsedTargetLifestyle.success ? parsedTargetLifestyle.data : null,
        )
      : null;

    return {
      nickname: sourceProfile.nickname,
      targetDormitoryId: targetSelection.dormitoryId,
      profile: toPublicProfile(user, sourceProfile, {
        ...exposure,
        ...(typeof scoreProjection === 'number' ? { matchScore: scoreProjection } : {}),
      }),
    };
  }

  async function materializeVisibleProfileEntries(
    viewerContext: VisibleProfileViewerContext,
    users: UserWithParticipantProjection[],
  ): Promise<VisiblePublicProfileEntry[]> {
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
        toVisiblePublicProfileEntry(user, viewerContext, viewerActiveMatch, activeMatchMap),
      )
      .filter((entry): entry is VisiblePublicProfileEntry => entry !== null)
      .sort((left, right) => left.nickname.localeCompare(right.nickname, 'ko'));
  }

  async function listVisibleProfileEntries(
    authUser: AuthenticatedUserContext,
    now: Date,
  ): Promise<{
    viewerContext: VisibleProfileViewerContext;
    entries: VisiblePublicProfileEntry[];
  }> {
    const viewerContext = await loadViewerContext(authUser, now);

    const users = (
      await deps.prisma.user.findMany({
        where: {
          id: { not: viewerContext.viewer.id },
          campus: viewerContext.viewer.campus,
          gender: viewerContext.viewer.gender,
          profile: { isNot: null },
        },
        select: buildUserWithProfileSelect(viewerContext.currentSeasonId),
      })
    ).map(mapUserWithParticipantProjection);

    const entries = await materializeVisibleProfileEntries(viewerContext, users);

    return {
      viewerContext,
      entries,
    };
  }

  async function getVisibleProfileEntryByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    now: Date,
  ): Promise<VisiblePublicProfileEntry | null> {
    const viewerContext = await loadViewerContext(authUser, now);
    const rawUser = await deps.prisma.user.findUnique({
      where: { id: targetUserId },
      select: buildUserWithProfileSelect(viewerContext.currentSeasonId),
    });
    if (!rawUser) {
      return null;
    }

    const user = mapUserWithParticipantProjection(rawUser);

    const [entry] = await materializeVisibleProfileEntries(viewerContext, [user]);
    return entry ?? null;
  }

  return {
    loadViewerContext,
    materializeVisibleProfileEntries,
    listVisibleProfileEntries,
    getVisibleProfileEntryByUserId,
  };
}
