import type { PublicProfile } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { BlockVisibilityReaderPort } from '../../social-safety/blocks/application/ports/block-visibility-reader.port.js';
import type { MatchActiveViewPort } from '../../matches/application/ports/match-active-view.port.js';
import type { MatchScoreProjectionPort } from '../../matches/application/ports/match-score-projection.port.js';
import type { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import { profilesErrors } from '../errors/profile.errors.js';
import { createPublicProfileTargetMaterializer } from '../targets/public-profile-target.materializer.js';

interface ProfileDetailQueryDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  seasonParticipantsService: SeasonParticipantsService;
  matchActiveView: MatchActiveViewPort;
  matchScoreProjection: MatchScoreProjectionPort;
  blockVisibilityReader: BlockVisibilityReaderPort;
}

export function createProfileDetailQuery(deps: ProfileDetailQueryDeps) {
  const publicProfileTargetReader = createPublicProfileTargetMaterializer(deps);

  async function getProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    options: { detailEntryToken?: string } = {},
  ): Promise<PublicProfile> {
    if (authUser.id === targetUserId) {
      throw profilesErrors.profileNotVisible();
    }

    const now = await deps.prisma.getDatabaseNow();
    const profile = await publicProfileTargetReader.getDetailProfileByUserId(
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
