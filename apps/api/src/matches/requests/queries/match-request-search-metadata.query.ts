import { Injectable } from '@nestjs/common';
import {
  findDirectionLimitReachedMatchRequestSearchMetadata,
  findPendingMatchRequestSearchMetadata,
} from '../../../generated/prisma/sql.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type {
  MatchRequestDirectionLimitMetadata,
  MatchRequestSearchMetadata,
  MatchRequestSearchMetadataDirection,
  MatchRequestSearchMetadataReaderPort,
} from '../../application/ports/match-request-search-metadata-reader.port.js';
import { isCooldownActive } from '../policies/match-request-expiration.policy.js';

@Injectable()
export class MatchRequestSearchMetadataQuery implements MatchRequestSearchMetadataReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async getLivePendingRequestMetadata(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
    now: Date;
  }): Promise<ReadonlyMap<string, MatchRequestSearchMetadata>> {
    const targetParticipantIds = [...new Set(input.targetParticipantIds)];
    if (targetParticipantIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.$queryRawTyped(
      findPendingMatchRequestSearchMetadata(
        input.seasonId,
        input.viewerParticipantId,
        targetParticipantIds,
        input.now,
      ),
    );

    const metadata = new Map<string, MatchRequestSearchMetadata>();
    for (const row of rows) {
      if (!row.targetParticipantId || !isPendingRequestDirection(row.direction)) {
        continue;
      }
      if (metadata.has(row.targetParticipantId)) {
        continue;
      }
      metadata.set(row.targetParticipantId, {
        requestId: row.id,
        direction: row.direction,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      });
    }
    return metadata;
  }

  async getDirectionLimitReachedMetadata(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
  }): Promise<ReadonlyMap<string, MatchRequestDirectionLimitMetadata>> {
    const targetParticipantIds = [...new Set(input.targetParticipantIds)];
    if (targetParticipantIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.$queryRawTyped(
      findDirectionLimitReachedMatchRequestSearchMetadata(
        input.seasonId,
        input.viewerParticipantId,
        targetParticipantIds,
      ),
    );

    const metadata = new Map<string, MatchRequestDirectionLimitMetadata>();
    for (const row of rows) {
      if (!row.targetParticipantId || typeof row.directionCount !== 'number') {
        continue;
      }
      metadata.set(row.targetParticipantId, {
        targetParticipantId: row.targetParticipantId,
        directionCount: row.directionCount,
      });
    }
    return metadata;
  }

  async isPendingSentLimitReached(input: {
    seasonId: string;
    viewerParticipantId: string;
    now: Date;
  }): Promise<boolean> {
    const count = await this.prisma.matchRequest.count({
      where: {
        seasonId: input.seasonId,
        requesterParticipantId: input.viewerParticipantId,
        status: 'PENDING',
        expiresAt: { gt: input.now },
      },
    });
    return count >= 3;
  }

  async getDirectionCooldownActiveTargetIds(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
    now: Date;
  }): Promise<ReadonlySet<string>> {
    const targetParticipantIds = [...new Set(input.targetParticipantIds)];
    if (targetParticipantIds.length === 0) {
      return new Set();
    }

    const [terminalRequests, unmatchedRelations] = await Promise.all([
      this.prisma.matchRequest.findMany({
        where: {
          seasonId: input.seasonId,
          requesterParticipantId: input.viewerParticipantId,
          receiverParticipantId: { in: targetParticipantIds },
          status: { in: ['REJECTED', 'CANCELLED_BY_REQUESTER', 'EXPIRED'] },
          terminalAt: { not: null },
        },
        select: { receiverParticipantId: true, terminalAt: true },
      }),
      this.prisma.activeMatch.findMany({
        where: {
          seasonId: input.seasonId,
          status: 'UNMATCHED',
          endedAt: { not: null },
          createdFromRequest: {
            requesterParticipantId: input.viewerParticipantId,
            receiverParticipantId: { in: targetParticipantIds },
          },
        },
        select: {
          endedAt: true,
          createdFromRequest: { select: { receiverParticipantId: true } },
        },
      }),
    ]);

    const latestByTarget = new Map<string, Date>();
    terminalRequests.forEach((request) => {
      if (request.terminalAt) {
        keepLatest(latestByTarget, request.receiverParticipantId, request.terminalAt);
      }
    });
    unmatchedRelations.forEach((relation) => {
      if (relation.endedAt) {
        keepLatest(
          latestByTarget,
          relation.createdFromRequest.receiverParticipantId,
          relation.endedAt,
        );
      }
    });

    return new Set(
      [...latestByTarget.entries()]
        .filter(([, referenceAt]) => isCooldownActive(referenceAt, input.now))
        .map(([targetParticipantId]) => targetParticipantId),
    );
  }
}

function keepLatest(values: Map<string, Date>, key: string, candidate: Date) {
  const current = values.get(key);
  if (!current || candidate.getTime() > current.getTime()) {
    values.set(key, candidate);
  }
}

function isPendingRequestDirection(
  value: string | null,
): value is MatchRequestSearchMetadataDirection {
  return value === 'SENT' || value === 'RECEIVED';
}
