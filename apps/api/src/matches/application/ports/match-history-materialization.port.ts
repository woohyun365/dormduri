export const MATCH_HISTORY_MATERIALIZATION_PORT = Symbol('MATCH_HISTORY_MATERIALIZATION_PORT');

export interface MatchHistoryMaterializationResult {
  processedSeasons: number;
  rebuiltEntries: number;
}

export interface MatchHistoryMaterializationPort {
  materializeEndedSeasonHistory(
    now: Date,
    userId?: string,
  ): Promise<MatchHistoryMaterializationResult>;

  materializeSeasonHistoryById(
    seasonId: string,
    now: Date,
  ): Promise<MatchHistoryMaterializationResult>;
}
