import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { DormitorySelectionState } from '../generated/prisma/enums.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import type {
  CurrentSeasonParticipantRecord,
  ParticipantBackfillSeed,
} from '../season-participants/season-participants.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';

export interface MatchUserSeed extends ParticipantBackfillSeed {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  dormitorySelectionState: DormitorySelectionState;
  profile: {
    lifestyle: unknown;
  } | null;
}

export interface MatchUserContext {
  user: MatchUserSeed;
  seasonContext: Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>;
  participant: CurrentSeasonParticipantRecord | null;
  selection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
}

interface MatchContextOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  requestTargetNotFound(): Error;
  requestSelfTargetNotAllowed(): Error;
}

export function createMatchContextOwner(deps: MatchContextOwnerDeps) {
  return {
    async getCurrentMatchContext(userId: string, now: Date): Promise<MatchUserContext | null> {
      const user = await this.getUserSeed(userId);
      if (!user) {
        throw new Error('[MatchesService] authenticated user not found');
      }

      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
      const participant = user.emailVerifiedAt
        ? await deps.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now)
        : null;
      const selection = deps.seasonParticipantsService.selectCanonicalSelection(user, participant);

      return {
        user,
        seasonContext,
        participant,
        selection,
      };
    },

    async getUserSeed(userId: string): Promise<MatchUserSeed | null> {
      return deps.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          emailVerifiedAt: true,
          gender: true,
          campus: true,
          dormitoryId: true,
          dormitorySelectionState: true,
          profile: {
            select: {
              lifestyle: true,
            },
          },
        },
      });
    },

    async getValidatedTargetUserForMatchRequest(
      targetUserId: string,
      requesterUser: MatchUserSeed,
    ): Promise<MatchUserSeed> {
      const targetUser = await this.getUserSeed(targetUserId);
      if (!targetUser) {
        throw deps.requestTargetNotFound();
      }
      if (targetUser.id === requesterUser.id) {
        throw deps.requestSelfTargetNotAllowed();
      }
      if (
        targetUser.campus !== requesterUser.campus ||
        targetUser.gender !== requesterUser.gender
      ) {
        throw deps.requestTargetNotFound();
      }

      return targetUser;
    },

    findRoomSelectionDate(
      seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
      dormitoryId: string | null,
    ) {
      return (
        seasonContext.operatedDormitories.find((item) => item.dormitoryId === dormitoryId)
          ?.roomSelectionDate ?? null
      );
    },
  };
}
