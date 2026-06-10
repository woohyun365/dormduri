import { Injectable } from '@nestjs/common';
import {
  loadSeasonHistorySource,
  type DbClient,
} from '../materialization/ended-season-history.loader.js';
import { buildHistoryRows } from '../materialization/match-history-row.builder.js';

@Injectable()
export class MatchHistoryRepository {
  async rebuildSeasonHistoryEntries(tx: DbClient, seasonId: string, now: Date): Promise<number> {
    const season = await loadSeasonHistorySource(tx, seasonId);
    if (!season) {
      return 0;
    }

    const rows = buildHistoryRows(season, now);

    await tx.seasonMatchHistoryEntry.deleteMany({
      where: {
        seasonId,
      },
    });

    if (rows.length > 0) {
      await tx.seasonMatchHistoryEntry.createMany({
        data: rows,
      });
    }

    return rows.length;
  }
}
