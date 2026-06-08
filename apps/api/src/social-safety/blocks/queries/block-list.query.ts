import { Injectable } from '@nestjs/common';
import type { BlockListResponse, ListBlocksQuery } from '@repo/shared/social-safety/block';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { currentSeasonParticipantSelect } from '../../../season-participants/participants/season-participant-records.js';
import { BlockPresenter, type BlockListItemView } from '../presenters/block.presenter.js';
import { BlockRepository, type BlockListRecord } from '../repositories/block.repository.js';
import { decodeBlockListCursor } from './block-list.cursor.js';

@Injectable()
export class BlockListQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BlockRepository,
    private readonly presenter: BlockPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    query: ListBlocksQuery;
  }): Promise<BlockListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const activeBlockCount = await this.repository.countActiveForBlocker({
      blockerUserId: input.authUser.id,
    });
    if (activeBlockCount === 0) {
      return this.presenter.toListResponse({
        items: [],
        activeBlockCount,
        hasNextPage: false,
        now,
      });
    }

    const cursor = decodeBlockListCursor(input.query.cursor);
    const rows = await this.repository.findActiveForBlocker({
      blockerUserId: input.authUser.id,
      limit: input.query.limit + 1,
      cursor: cursor ? { blockedAt: new Date(cursor.blockedAt), id: cursor.id } : null,
    });
    const pageRows = rows.slice(0, input.query.limit);
    const visibilityMap = await this.loadVisibilityMap({
      viewerUserId: input.authUser.id,
      targetUserIds: pageRows.map((row) => row.blockedUserId),
      now,
    });

    return this.presenter.toListResponse({
      items: pageRows.map((row) => this.toListItem(row, visibilityMap.get(row.blockedUserId))),
      activeBlockCount,
      hasNextPage: rows.length > input.query.limit,
      now,
    });
  }

  private async loadVisibilityMap(input: {
    viewerUserId: string;
    targetUserIds: string[];
    now: Date;
  }): Promise<Map<string, { displayName: string | null; visible: boolean }>> {
    if (input.targetUserIds.length === 0) {
      return new Map();
    }

    const viewer = await this.prisma.user.findUnique({
      where: { id: input.viewerUserId },
      select: { campus: true, gender: true, deletedAt: true },
    });
    if (!viewer || viewer.deletedAt) {
      return new Map();
    }

    const currentSeason = await this.prisma.season.findFirst({
      where: {
        campusCode: viewer.campus,
        preparationStartDate: { lte: input.now },
        seasonEndDate: { gte: input.now },
      },
      select: { id: true },
      orderBy: [{ matchingStartDate: 'desc' }, { id: 'desc' }],
    });
    if (!currentSeason) {
      return new Map();
    }

    const participants = await this.prisma.seasonParticipant.findMany({
      where: {
        seasonId: currentSeason.id,
        userId: { in: input.targetUserIds },
        user: { campus: viewer.campus, gender: viewer.gender, deletedAt: null },
      },
      select: currentSeasonParticipantSelect,
    });

    return new Map(
      participants.map((participant) => [
        participant.userId,
        {
          visible:
            participant.hiddenByAdminAt === null &&
            participant.deactivatedAt === null &&
            participant.participantStatus !== 'WITHDRAWN' &&
            participant.participantStatus !== 'EXPIRED' &&
            participant.profile !== null,
          displayName: participant.profile?.nicknameSnapshot ?? null,
        },
      ]),
    );
  }

  private toListItem(
    row: BlockListRecord,
    visibility: { displayName: string | null; visible: boolean } | undefined,
  ): BlockListItemView {
    const visible = row.blockedUser.deletedAt === null && visibility?.visible === true;
    return {
      id: row.id,
      blockedUserId: row.blockedUserId,
      blockedAt: row.blockedAt,
      note: row.note,
      visibility: visible ? 'VISIBLE' : 'NO_LONGER_VISIBLE',
      displayName: visible
        ? (visibility?.displayName ?? row.blockedUser.displayIdentity?.nickname ?? null)
        : null,
    };
  }
}
