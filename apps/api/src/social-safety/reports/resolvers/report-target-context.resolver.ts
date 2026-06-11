import { Inject, Injectable } from '@nestjs/common';
import type { ReportTargetType } from '@repo/shared/social-safety/report';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { CHAT_REPORT_TARGET_CONTEXT_PORT } from '../../../chat/application/ports/chat-report-target-context.port.js';
import type {
  ChatReportTargetClient,
  ChatReportTargetContextPort,
} from '../../../chat/application/ports/chat-report-target-context.port.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { reportErrors } from '../errors/report.errors.js';

export interface ResolvedReportTargetContext {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId: string | null;
  targetParticipantId: string | null;
  targetThreadId: string | null;
  targetMessageId: string | null;
  targetMatchRequestId: string | null;
  seasonId: string | null;
  status: 'SUBMITTED' | 'EVIDENCE_ONLY';
  snapshot: Prisma.InputJsonObject;
}

type ReportTargetResolverClient = Pick<
  Prisma.TransactionClient,
  'seasonParticipant' | 'matchRequest'
> &
  ChatReportTargetClient;

const actorParticipantSelect = {
  id: true,
  userId: true,
  seasonId: true,
  participantStatus: true,
  user: { select: { id: true, campus: true, gender: true, deletedAt: true } },
} satisfies Prisma.SeasonParticipantSelect;

type ActorParticipant = Prisma.SeasonParticipantGetPayload<{
  select: typeof actorParticipantSelect;
}>;

const targetParticipantSelect = {
  id: true,
  userId: true,
  seasonId: true,
  participantStatus: true,
  dormitoryId: true,
  profile: {
    select: {
      participantId: true,
      nicknameSnapshot: true,
    },
  },
} satisfies Prisma.SeasonParticipantSelect;

function actionableParticipantWhere(): Prisma.SeasonParticipantWhereInput {
  return {
    hiddenByAdminAt: null,
    deactivatedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    participantStatus: { in: ['ACTIVE', 'MATCHED'] },
  };
}

@Injectable()
export class ReportTargetContextResolver {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHAT_REPORT_TARGET_CONTEXT_PORT)
    private readonly chatReportTargetContext: ChatReportTargetContextPort,
  ) {}

  async resolve(input: {
    authUser: AuthenticatedUserContext;
    targetType: ReportTargetType;
    targetId: string;
    client?: ReportTargetResolverClient;
  }): Promise<ResolvedReportTargetContext> {
    if (input.targetType === 'SUPPORT_TICKET') {
      throw reportErrors.targetNotSupported();
    }

    const actorParticipant = await this.loadActorParticipant(input.authUser, input.client);
    if (!actorParticipant) {
      throw reportErrors.targetNotReportable();
    }

    switch (input.targetType) {
      case 'PROFILE':
        return this.resolveProfileTarget(input.targetId, actorParticipant, input.client);
      case 'MATCH_REQUEST':
        return this.resolveMatchRequestTarget(input.targetId, actorParticipant, input.client);
      case 'CHAT_THREAD':
        return this.resolveChatThreadTarget(input.targetId, actorParticipant, input.client);
      case 'CHAT_MESSAGE':
        return this.resolveChatMessageTarget(input.targetId, actorParticipant, input.client);
      default:
        throw reportErrors.targetNotSupported();
    }
  }

  private async loadActorParticipant(
    authUser: AuthenticatedUserContext,
    client?: ReportTargetResolverClient,
  ) {
    const db = client ?? this.prisma;
    return db.seasonParticipant.findFirst({
      where: {
        userId: authUser.id,
        ...actionableParticipantWhere(),
        user: {
          deletedAt: null,
          campus: authUser.campus,
          gender: authUser.gender,
        },
      },
      select: actorParticipantSelect,
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
    });
  }

  private async resolveProfileTarget(
    targetUserId: string,
    actorParticipant: ActorParticipant,
    client?: ReportTargetResolverClient,
  ): Promise<ResolvedReportTargetContext> {
    if (targetUserId === actorParticipant.userId) {
      throw reportErrors.targetNotReportable();
    }

    const db = client ?? this.prisma;
    const target = await db.seasonParticipant.findFirst({
      where: {
        seasonId: actorParticipant.seasonId,
        userId: targetUserId,
        ...actionableParticipantWhere(),
        user: {
          deletedAt: null,
          campus: actorParticipant.user.campus,
          gender: actorParticipant.user.gender,
        },
      },
      select: targetParticipantSelect,
    });
    if (!target) {
      throw reportErrors.targetNotReportable();
    }

    return {
      targetType: 'PROFILE',
      targetId: target.userId,
      targetUserId: target.userId,
      targetParticipantId: target.id,
      targetThreadId: null,
      targetMessageId: null,
      targetMatchRequestId: null,
      seasonId: target.seasonId,
      status: 'SUBMITTED',
      snapshot: {
        targetKind: 'PROFILE',
        targetUserId: target.userId,
        targetParticipantId: target.id,
        seasonId: target.seasonId,
        participantStatus: target.participantStatus,
        dormitoryId: target.dormitoryId,
        profileSnapshotExists: target.profile !== null,
      },
    };
  }

  private async resolveMatchRequestTarget(
    targetId: string,
    actorParticipant: ActorParticipant,
    client?: ReportTargetResolverClient,
  ): Promise<ResolvedReportTargetContext> {
    const db = client ?? this.prisma;
    const request = await db.matchRequest.findFirst({
      where: {
        id: targetId,
        seasonId: actorParticipant.seasonId,
        OR: [
          { requesterParticipantId: actorParticipant.id },
          { receiverParticipantId: actorParticipant.id },
        ],
      },
      select: {
        id: true,
        seasonId: true,
        requesterParticipantId: true,
        receiverParticipantId: true,
        status: true,
        terminalReason: true,
        requesterParticipant: { select: { id: true, userId: true } },
        receiverParticipant: { select: { id: true, userId: true } },
      },
    });
    if (!request) {
      throw reportErrors.targetNotReportable();
    }

    const counterpart =
      request.requesterParticipantId === actorParticipant.id
        ? request.receiverParticipant
        : request.requesterParticipant;

    return {
      targetType: 'MATCH_REQUEST',
      targetId: request.id,
      targetUserId: counterpart.userId,
      targetParticipantId: counterpart.id,
      targetThreadId: null,
      targetMessageId: null,
      targetMatchRequestId: request.id,
      seasonId: request.seasonId,
      status: 'SUBMITTED',
      snapshot: {
        targetKind: 'MATCH_REQUEST',
        matchRequestId: request.id,
        requesterParticipantId: request.requesterParticipantId,
        receiverParticipantId: request.receiverParticipantId,
        status: request.status,
        terminalReason: request.terminalReason,
      },
    };
  }

  private async resolveChatThreadTarget(
    targetId: string,
    actorParticipant: ActorParticipant,
    client?: ReportTargetResolverClient,
  ): Promise<ResolvedReportTargetContext> {
    const thread = await this.chatReportTargetContext.resolveThreadTarget({
      actorParticipantId: actorParticipant.id,
      seasonId: actorParticipant.seasonId,
      threadId: targetId,
      client,
    });
    if (!thread) {
      throw reportErrors.targetNotReportable();
    }

    return {
      targetType: 'CHAT_THREAD',
      targetId: thread.threadId,
      targetUserId: thread.counterpartUserId,
      targetParticipantId: thread.counterpartParticipantId,
      targetThreadId: thread.threadId,
      targetMessageId: null,
      targetMatchRequestId: null,
      seasonId: thread.seasonId,
      status: 'SUBMITTED',
      snapshot: {
        targetKind: 'CHAT_THREAD',
        threadId: thread.threadId,
        threadKind: thread.threadKind,
        status: thread.status,
        closedReason: thread.closedReason,
        participantAId: thread.participantAId,
        participantBId: thread.participantBId,
      },
    };
  }

  private async resolveChatMessageTarget(
    targetId: string,
    actorParticipant: ActorParticipant,
    client?: ReportTargetResolverClient,
  ): Promise<ResolvedReportTargetContext> {
    const message = await this.chatReportTargetContext.resolveMessageTarget({
      actorParticipantId: actorParticipant.id,
      seasonId: actorParticipant.seasonId,
      messageId: targetId,
      client,
    });
    if (!message) {
      throw reportErrors.targetNotReportable();
    }

    return {
      targetType: 'CHAT_MESSAGE',
      targetId: message.messageId,
      targetUserId: message.senderUserId,
      targetParticipantId: message.senderParticipantId,
      targetThreadId: message.threadId,
      targetMessageId: message.messageId,
      targetMatchRequestId: null,
      seasonId: message.seasonId,
      status: 'SUBMITTED',
      snapshot: {
        targetKind: 'CHAT_MESSAGE',
        messageId: message.messageId,
        threadId: message.threadId,
        senderParticipantId: message.senderParticipantId,
        bodyState: message.bodyState,
        tombstoneReason: message.tombstoneReason,
        participantAId: message.participantAId,
        participantBId: message.participantBId,
      },
    };
  }
}
