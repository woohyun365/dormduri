import type { Provider } from '@nestjs/common';
import {
  MATCH_ACTIVE_VIEW_PORT,
  type MatchActiveViewPort,
} from '../../matches/application/ports/match-active-view.port.js';
import {
  MATCH_SCORE_PROJECTION_PORT,
  type MatchScoreProjectionPort,
} from '../../matches/application/ports/match-score-projection.port.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { ProfilesService } from '../application/profiles.service.js';
import { PROFILE_PUBLIC_TARGET_READER_PORT } from '../contracts/profile-public-target-reader.port.js';
import { createPublicProfileTargetMaterializer } from '../targets/public-profile-target.materializer.js';

export const PROFILE_PUBLIC_TARGET_READER_PROVIDER: Provider = {
  provide: PROFILE_PUBLIC_TARGET_READER_PORT,
  useFactory: (
    prisma: PrismaService,
    seasonsService: SeasonContextPort,
    seasonParticipantsService: SeasonParticipantsService,
    matchActiveView: MatchActiveViewPort,
    matchScoreProjection: MatchScoreProjectionPort,
  ) =>
    createPublicProfileTargetMaterializer({
      prisma,
      seasonsService,
      seasonParticipantsService,
      matchActiveView,
      matchScoreProjection,
    }),
  inject: [
    PrismaService,
    SEASON_CONTEXT_PORT,
    SeasonParticipantsService,
    MATCH_ACTIVE_VIEW_PORT,
    MATCH_SCORE_PROJECTION_PORT,
  ],
};

export const PROFILES_PROVIDERS: Provider[] = [
  ProfilesService,
  PROFILE_PUBLIC_TARGET_READER_PROVIDER,
];

export const PROFILES_EXPORTS = [PROFILE_PUBLIC_TARGET_READER_PORT];
