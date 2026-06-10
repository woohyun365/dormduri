import type { ActiveMatchSummary } from '@repo/shared/match-contract';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';

export const MATCH_ACTIVE_VIEW_PORT = Symbol('MATCH_ACTIVE_VIEW_PORT');

export interface MatchActiveViewPort {
  getCurrentActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchSummary | null>;

  getCurrentActiveMatchSummaryForParticipant(
    seasonContext: CurrentSeasonContext,
    participantId: string,
    now: Date,
  ): Promise<ActiveMatchSummary | null>;

  getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>>;
}
