import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { chatErrors } from './chat.errors.js';
import type { ChatParticipantUserProjection } from './chat-selects.js';

type ChatContextDbClient = Prisma.TransactionClient | PrismaService;

export interface ChatUserContext {
  user: ChatParticipantUserProjection;
  seasonContext: Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>;
  participant: CurrentSeasonParticipantRecord | null;
  selection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
}

interface ChatContextOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
}

export function createChatContextOwner(deps: ChatContextOwnerDeps) {
  return {
    async getChatUserProjection(
      userId: string,
      client: ChatContextDbClient = deps.prisma,
    ): Promise<ChatParticipantUserProjection | null> {
      const user = await client.user.findUnique({
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

    async getCurrentChatContext(userId: string, now: Date): Promise<ChatUserContext | null> {
      const user = await this.getChatUserProjection(userId);
      if (!user) {
        throw new Error('[ChatService] authenticated user not found');
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

    async getValidatedTargetUser(
      targetUserId: string,
      viewerUser: ChatParticipantUserProjection,
      client: ChatContextDbClient = deps.prisma,
    ): Promise<ChatParticipantUserProjection> {
      const targetUser = await this.getChatUserProjection(targetUserId, client);
      if (!targetUser || targetUser.id === viewerUser.id) {
        throw chatErrors.threadTargetNotFound();
      }
      if (targetUser.campus !== viewerUser.campus || targetUser.gender !== viewerUser.gender) {
        throw chatErrors.threadTargetNotFound();
      }

      return targetUser;
    },

    async getRequiredParticipant(
      targetUser: ChatParticipantUserProjection,
      seasonId: string,
      client?: Prisma.TransactionClient,
    ): Promise<CurrentSeasonParticipantRecord> {
      const participant = await deps.seasonParticipantsService.findCurrentSeasonParticipant(
        targetUser.id,
        seasonId,
        client,
      );
      if (!participant) {
        throw chatErrors.threadTargetNotFound();
      }

      return participant;
    },
  };
}
