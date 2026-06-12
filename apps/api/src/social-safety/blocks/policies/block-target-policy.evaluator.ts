import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { Campus, Gender } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantQueryRecord,
  type CurrentSeasonParticipantRecord,
} from '../../../season-participants/participants/season-participant-records.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { resolveCampusServiceState } from '../../../seasons/runtime/campus-service-state.query.js';
import { blockErrors } from '../errors/block.errors.js';

interface BlockViewerContext {
  viewer: {
    id: string;
    gender: Gender;
    campus: Campus;
    deletedAt: Date | null;
  };
  seasonContext: CurrentSeasonContext;
  viewerParticipant: CurrentSeasonParticipantRecord;
}

export interface ResolvedBlockTarget {
  viewerContext: BlockViewerContext;
  targetUserId: string;
  targetParticipant: CurrentSeasonParticipantRecord;
}

type TargetParticipantRecord = CurrentSeasonParticipantQueryRecord & {
  user: { id: string; deletedAt: Date | null };
};

type BlockPolicyClient = Prisma.TransactionClient;

const blockViewerSelect = {
  id: true,
  gender: true,
  campus: true,
  deletedAt: true,
} as const;

const targetParticipantSelect = {
  ...currentSeasonParticipantSelect,
  user: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
} as const;

@Injectable()
export class BlockTargetPolicyEvaluator {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

  async resolveCreateTarget(input: {
    authUser: AuthenticatedUserContext;
    targetUserId: string;
    now: Date;
    client?: BlockPolicyClient;
  }): Promise<ResolvedBlockTarget> {
    if (input.authUser.id === input.targetUserId) {
      throw blockErrors.targetNotBlockable();
    }

    const viewerContext = await this.loadViewerContext(input.authUser, input.now, input.client);
    const target = await this.findCurrentTargetParticipant({
      client: input.client,
      seasonId: viewerContext.seasonContext.season.id,
      targetUserId: input.targetUserId,
      viewerCampus: viewerContext.viewer.campus,
      viewerGender: viewerContext.viewer.gender,
    });
    if (!target || target.user.deletedAt || !isBlockableParticipant(target)) {
      throw blockErrors.targetNotBlockable();
    }

    const targetParticipant = mapCurrentSeasonParticipantRecord(target);
    if (
      await this.hasActiveMatchBetweenParticipants({
        client: input.client,
        seasonId: viewerContext.seasonContext.season.id,
        leftParticipantId: viewerContext.viewerParticipant.id,
        rightParticipantId: targetParticipant.id,
      })
    ) {
      throw blockErrors.activeMatchBlockNotAllowed();
    }

    return {
      viewerContext,
      targetUserId: target.user.id,
      targetParticipant,
    };
  }

  async loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
    client?: BlockPolicyClient,
  ): Promise<BlockViewerContext> {
    const db = client ?? this.prisma;
    const viewer = await db.user.findUnique({
      where: { id: authUser.id },
      select: blockViewerSelect,
    });
    if (!viewer || viewer.deletedAt) {
      throw blockErrors.targetNotBlockable();
    }

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      viewer.campus,
      now,
    );
    if (!serviceState.seasonContext) {
      throw blockErrors.targetNotBlockable();
    }

    const viewerParticipant = await this.seasonParticipantsService.findCurrentSeasonParticipant(
      viewer.id,
      serviceState.seasonContext.season.id,
      client,
    );
    if (!viewerParticipant || !isBlockableParticipant(viewerParticipant)) {
      throw blockErrors.targetNotBlockable();
    }

    return {
      viewer,
      seasonContext: serviceState.seasonContext,
      viewerParticipant,
    };
  }

  private async findCurrentTargetParticipant(input: {
    client?: BlockPolicyClient;
    seasonId: string;
    targetUserId: string;
    viewerCampus: Campus;
    viewerGender: Gender;
  }): Promise<TargetParticipantRecord | null> {
    const db = input.client ?? this.prisma;
    return db.seasonParticipant.findFirst({
      where: {
        seasonId: input.seasonId,
        userId: input.targetUserId,
        user: {
          campus: input.viewerCampus,
          gender: input.viewerGender,
        },
      },
      select: targetParticipantSelect,
    });
  }

  private async hasActiveMatchBetweenParticipants(input: {
    client?: BlockPolicyClient;
    seasonId: string;
    leftParticipantId: string;
    rightParticipantId: string;
  }): Promise<boolean> {
    const db = input.client ?? this.prisma;
    const activeMatch = await db.activeMatch.findFirst({
      where: {
        seasonId: input.seasonId,
        status: 'ACTIVE',
        endedAt: null,
        OR: [
          {
            participantAId: input.leftParticipantId,
            participantBId: input.rightParticipantId,
          },
          {
            participantAId: input.rightParticipantId,
            participantBId: input.leftParticipantId,
          },
        ],
      },
      select: { id: true },
    });

    return activeMatch !== null;
  }
}

function isBlockableParticipant(
  participant: Pick<
    CurrentSeasonParticipantRecord,
    'hiddenByAdminAt' | 'deactivatedAt' | 'participantStatus'
  >,
): boolean {
  return (
    participant.hiddenByAdminAt === null &&
    participant.deactivatedAt === null &&
    participant.participantStatus !== 'WITHDRAWN' &&
    participant.participantStatus !== 'EXPIRED'
  );
}
