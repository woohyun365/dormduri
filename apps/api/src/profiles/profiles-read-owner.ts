import type { PublicProfileListResponse } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
} from '../season-participants/season-participant-gate-context.js';
import { canCurrentDormitoryMatch } from '../season-participants/season-participant-policy.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import { buildUserWithProfileSelect } from '../users/current-user-select.js';
import { toPublicProfile } from './profile.mapper.js';
import { resolveProfileExposure } from './profile-visibility.js';
import { profilesErrors } from './profiles.errors.js';
import {
  getUserWithProfile,
  type UserWithParticipantProjection,
} from './profiles-owner-support.js';

interface ProfilesReadOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  matchesService: MatchesService;
}

export function createProfilesReadOwner(deps: ProfilesReadOwnerDeps) {
  async function loadViewerReadContext(authUser: AuthenticatedUserContext, now: Date) {
    const viewer = await getUserWithProfile(deps.prisma, authUser.id);
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

    return {
      viewer,
      serviceState,
      viewerParticipant,
      viewerSelection,
      operatedDormitoryIds,
      currentDormitoryCanMatch: canCurrentDormitoryMatch(
        serviceState.seasonContext,
        viewerSelection.dormitoryId,
        now,
      ),
    };
  }

  function toVisiblePublicProfile(
    user: UserWithParticipantProjection,
    viewerParticipant: CurrentSeasonParticipantRecord | null,
    viewerActiveMatch: Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>,
    viewerSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>,
    campusOperated: boolean,
    seasonState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null,
    operatedDormitoryIds: Set<string>,
    currentDormitoryCanMatch: boolean,
    activeMatchMap: Map<
      string,
      Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
    >,
  ) {
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
        campusOperated,
        seasonState,
        participant: viewerParticipant,
        matched: viewerActiveMatch !== null,
        matchedPartnerParticipantId: viewerActiveMatch?.counterpartParticipantId ?? null,
        selection: viewerSelection,
        operatedDormitoryIds,
        currentDormitoryCanMatch,
      }),
      target: buildPublicExposureTargetInput({
        seasonState,
        operatedDormitoryIds,
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
    const publicProfile = toPublicProfile(user, sourceProfile, exposure);

    return {
      nickname: sourceProfile.nickname,
      profile: publicProfile,
    };
  }

  async function getProfiles(
    authUser: AuthenticatedUserContext,
    query: { offset: number; limit: number },
  ): Promise<PublicProfileListResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await loadViewerReadContext(authUser, now);

    const users = await deps.prisma.user.findMany({
      where: {
        id: { not: viewerContext.viewer.id },
        campus: viewerContext.viewer.campus,
        gender: viewerContext.viewer.gender,
        profile: { isNot: null },
      },
      select: buildUserWithProfileSelect(
        viewerContext.serviceState.seasonContext?.season.id ?? null,
      ),
    });

    const currentSeasonId = viewerContext.serviceState.seasonContext?.season.id ?? null;
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      ...users.map(
        (user) =>
          deps.seasonParticipantsService.pickCurrentSeasonParticipant(user.seasonParticipants)
            ?.id ?? null,
      ),
    ].filter((participantId): participantId is string => participantId !== null);
    const activeMatchMap = currentSeasonId
      ? await deps.matchesService.getLiveActiveMatchMapForParticipantIds(
          currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerContext.viewerParticipant
      ? (activeMatchMap.get(viewerContext.viewerParticipant.id) ?? null)
      : null;

    const visibleUsers = users
      .map((user) =>
        toVisiblePublicProfile(
          user,
          viewerContext.viewerParticipant,
          viewerActiveMatch,
          viewerContext.viewerSelection,
          viewerContext.serviceState.campusOperated,
          viewerContext.serviceState.seasonState,
          viewerContext.operatedDormitoryIds,
          viewerContext.currentDormitoryCanMatch,
          activeMatchMap,
        ),
      )
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.nickname.localeCompare(right.nickname, 'ko'))
      .slice(query.offset, query.offset + query.limit)
      .map(({ profile }) => profile);

    return { items: visibleUsers };
  }

  async function getProfileByUserId(authUser: AuthenticatedUserContext, targetUserId: string) {
    if (authUser.id === targetUserId) {
      throw profilesErrors.profileNotVisible();
    }

    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await loadViewerReadContext(authUser, now);

    const user = await deps.prisma.user.findUnique({
      where: { id: targetUserId },
      select: buildUserWithProfileSelect(
        viewerContext.serviceState.seasonContext?.season.id ?? null,
      ),
    });
    if (!user) {
      throw profilesErrors.profileNotVisible();
    }

    const targetParticipant = deps.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const currentSeasonId = viewerContext.serviceState.seasonContext?.season.id ?? null;
    const participantIds = [
      viewerContext.viewerParticipant?.id ?? null,
      targetParticipant?.id ?? null,
    ].filter((participantId): participantId is string => participantId !== null);
    const activeMatchMap = currentSeasonId
      ? await deps.matchesService.getLiveActiveMatchMapForParticipantIds(
          currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerContext.viewerParticipant
      ? (activeMatchMap.get(viewerContext.viewerParticipant.id) ?? null)
      : null;

    const visibleProfile = toVisiblePublicProfile(
      user,
      viewerContext.viewerParticipant,
      viewerActiveMatch,
      viewerContext.viewerSelection,
      viewerContext.serviceState.campusOperated,
      viewerContext.serviceState.seasonState,
      viewerContext.operatedDormitoryIds,
      viewerContext.currentDormitoryCanMatch,
      activeMatchMap,
    );
    if (!visibleProfile) {
      throw profilesErrors.profileNotVisible();
    }

    return visibleProfile.profile;
  }

  return {
    getProfiles,
    getProfileByUserId,
  };
}
