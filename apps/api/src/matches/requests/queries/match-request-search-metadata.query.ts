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
}

function isPendingRequestDirection(
  value: string | null,
): value is MatchRequestSearchMetadataDirection {
  return value === 'SENT' || value === 'RECEIVED';
}
