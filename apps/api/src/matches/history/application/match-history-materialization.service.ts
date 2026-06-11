import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type {
  MatchHistoryMaterializationPort,
  MatchHistoryMaterializationResult,
} from '../../application/ports/match-history-materialization.port.js';
import { findEndedSeasonIds } from '../materialization/ended-season-history.loader.js';
import { MatchHistoryRepository } from '../persistence/match-history.repository.js';

@Injectable()
export class MatchHistoryMaterializationService implements MatchHistoryMaterializationPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: MatchHistoryRepository,
  ) {}

  async materializeEndedSeasonHistory(
    now: Date,
    userId?: string,
  ): Promise<MatchHistoryMaterializationResult> {
    const endedSeasonIds = await findEndedSeasonIds(this.prisma, now, userId);
    let rebuiltEntries = 0;

    for (const seasonId of endedSeasonIds) {
      rebuiltEntries += await this.prisma.runSerializableTransaction((tx) =>
        this.repository.rebuildSeasonHistoryEntries(tx, seasonId, now),
      );
    }

    return {
      processedSeasons: endedSeasonIds.length,
      rebuiltEntries,
    };
  }

  async materializeSeasonHistoryById(
    seasonId: string,
    now: Date,
  ): Promise<MatchHistoryMaterializationResult> {
    const rebuiltEntries = await this.prisma.runSerializableTransaction((tx) =>
      this.repository.rebuildSeasonHistoryEntries(tx, seasonId, now),
    );

    return {
      processedSeasons: rebuiltEntries > 0 ? 1 : 0,
      rebuiltEntries,
    };
  }
}
