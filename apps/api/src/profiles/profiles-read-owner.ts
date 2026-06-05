import type { PublicProfile } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../platform/database/prisma.service.js';
import type { MatchesService } from '../matches/matches.service.js';
import type { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
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

  async function getProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    options: { detailEntryToken?: string } = {},
  ): Promise<PublicProfile> {
    if (authUser.id === targetUserId) {
      throw profilesErrors.profileNotVisible();
    }

    const now = await deps.prisma.getDatabaseNow();
    const profile = await visibleProfileOwner.getDetailProfileByUserId(
      authUser,
      targetUserId,
      now,
      options,
    );
    if (!profile) {
      throw profilesErrors.profileNotVisible();
    }

    return profile;
  }

  return {
    getProfileByUserId,
  };
}
