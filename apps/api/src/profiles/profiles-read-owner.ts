import type { PublicProfileListResponse } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { MatchesService } from '../matches/matches.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { profilesErrors } from './profiles.errors.js';
import { createVisibleProfileOwner } from './visible-profile-owner.js';

interface ProfilesReadOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  matchesService: MatchesService;
}

export function createProfilesReadOwner(deps: ProfilesReadOwnerDeps) {
  const visibleProfileOwner = createVisibleProfileOwner(deps);

  async function getProfiles(
    authUser: AuthenticatedUserContext,
    query: { offset: number; limit: number },
  ): Promise<PublicProfileListResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const { entries } = await visibleProfileOwner.listVisibleProfileEntries(authUser, now);

    return {
      items: entries.slice(query.offset, query.offset + query.limit).map((entry) => entry.profile),
    };
  }

  async function getProfileByUserId(authUser: AuthenticatedUserContext, targetUserId: string) {
    if (authUser.id === targetUserId) {
      throw profilesErrors.profileNotVisible();
    }

    const now = await deps.prisma.getDatabaseNow();
    const entry = await visibleProfileOwner.getVisibleProfileEntryByUserId(
      authUser,
      targetUserId,
      now,
    );
    if (!entry) {
      throw profilesErrors.profileNotVisible();
    }

    return entry.profile;
  }

  return {
    getProfiles,
    getProfileByUserId,
  };
}
