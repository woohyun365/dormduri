import { Inbox, MessagesSquare, Send, Zap } from 'lucide-react';
import type { MatchingNavOptions, TabId } from '@/types/profile';
import type { MatchingSummaryStats } from './model/matchingSummaryContent';
import { resolveMatchingActionContent } from './model/matchingSummaryContent';
import { MatchingHelperMessage, MatchingMetricActionCard } from './MatchingMetricCard';

export function MatchingActionList({
  stats,
  onNavigate,
}: {
  stats: MatchingSummaryStats;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const maxPending = stats.maxPending ?? 3;
  const expiringCount = stats.expiringCount ?? 0;
  const content = resolveMatchingActionContent();

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <MatchingMetricActionCard
          icon={Send}
          label="보낸 요청"
          value={stats.sentRequests}
          helper={content.sentHelper}
          tone="amber"
          maxSlots={maxPending}
          onClick={() => onNavigate('matching', { requestTab: 'sent' })}
        />
        <MatchingMetricActionCard
          icon={Inbox}
          label="받은 요청"
          value={stats.receivedRequests}
          helper={content.receivedHelper}
          tone="purple"
          expiringCount={expiringCount}
          onClick={() => onNavigate('matching', { requestTab: 'received' })}
        />
        <MatchingMetricActionCard
          icon={MessagesSquare}
          label="대화 중"
          value={stats.activeChats}
          helper={content.chatHelper}
          tone="teal"
          onClick={() => onNavigate('matching', { section: 'current' })}
        />
      </div>

      <MatchingHelperMessage icon={<Zap className="size-3.5 text-amber-500" aria-hidden={true} />}>
        {content.helper}
      </MatchingHelperMessage>
    </>
  );
}
