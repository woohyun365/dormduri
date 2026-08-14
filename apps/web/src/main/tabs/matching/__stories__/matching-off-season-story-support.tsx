import type { ConversationStatsResponse } from '@repo/shared/chat';
import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import type { MatchHistoryCounterpartDetailClient } from '../hooks/useMatchHistoryCounterpartDetail';
import type { MatchHistorySelfProfileClient } from '../hooks/useMatchHistorySelfProfile';
import { MatchHistorySection } from '../sections/history/MatchHistorySection';
import {
  offSeasonConversationStats,
  offSeasonHistory,
  offSeasonHistoryDetailClient,
  offSeasonHistorySelfProfileClient,
  offSeasonHistorySummary,
} from './matching-off-season-story-fixtures';

export const offSeasonStoryState = {
  kind: 'off-season',
  historySummary: offSeasonHistorySummary,
} as const;

export function offSeasonHistoryContent(
  data: MatchHistoryResponse = offSeasonHistory,
  detailClient: MatchHistoryCounterpartDetailClient | undefined = offSeasonHistoryDetailClient,
  conversationStats: ConversationStatsResponse | null = offSeasonConversationStats,
  selfProfileClient: MatchHistorySelfProfileClient | undefined = offSeasonHistorySelfProfileClient,
) {
  return (
    <MatchHistorySection
      data={data}
      loading={false}
      error={null}
      onRetry={() => undefined}
      detailClient={detailClient}
      selfProfileClient={selfProfileClient}
      conversationStats={conversationStats}
    />
  );
}
