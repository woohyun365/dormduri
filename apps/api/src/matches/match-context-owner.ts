import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import type {
  CurrentSeasonParticipantRecord,
  SeasonParticipantEnsureInput,
} from '../season-participants/season-participants.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';

export interface MatchParticipantUserProjection extends SeasonParticipantEnsureInput {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
}

export interface MatchUserContext {
  user: MatchParticipantUserProjection;
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
      const user = await this.getMatchUserProjection(userId);
      if (!user) {
        throw new Error('[MatchesService] authenticated user not found');
      }

      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
      const participant = user.emailVerifiedAt
        ? await deps.seasonParticipantsService.ensureCurrentSeasonParticipant(user, now)
        : null;
      const selection = deps.seasonParticipantsService.selectCanonicalSelection(participant);

      return {
        user,
        seasonContext,
        participant,
        selection,
      };
    },

    async getMatchUserProjection(userId: string): Promise<MatchParticipantUserProjection | null> {
      const user = await deps.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          emailVerifiedAt: true,
          gender: true,
          campus: true,
          deletedAt: true,
        },
      });
      if (!user || user.deletedAt) {
        return null;
      }

      return user;
    },

    async getValidatedTargetUserForMatchRequest(
      targetUserId: string,
      requesterUser: MatchParticipantUserProjection,
    ): Promise<MatchParticipantUserProjection> {
      const targetUser = await this.getMatchUserProjection(targetUserId);
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
