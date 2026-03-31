'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  CheckCircle,
  XCircle,
  Inbox,
  Send,
  MessageCircle,
  Building2,
} from 'lucide-react';
import { MatchingCompactCard } from './MatchingCompactCard';
import { getDormitoryById } from '@/constants/dormitory';
import { sectionCard } from '@/main/styles/home';
import { matchingHistoryCardBorder } from '@/main/styles/matching';
import { getPastHistoryVisualMeta, getRepeatedCancelledVisualMeta } from './historyDisplay';
import type { HistoryItemData, PastSeasonData } from '@/types/match';

interface PastSeasonAccordionProps {
  season: PastSeasonData;
  defaultExpanded?: boolean;
}

function SummaryStat({
  icon,
  label,
  value,
  iconTone,
  valueTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconTone: string;
  valueTone: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--knu-background-alt)] px-3 py-3 text-center">
      <div
        className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${iconTone}`}
      >
        {icon}
      </div>
      <p className={`text-base font-bold leading-none ${valueTone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--knu-text-tertiary)]">{label}</p>
    </div>
  );
}

export function PastSeasonAccordion({ season, defaultExpanded = false }: PastSeasonAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const success = season.matchResult === 'success';
  const dormitoryName = season.dormitoryIdSnapshot
    ? (getDormitoryById(season.dormitoryIdSnapshot)?.name ?? null)
    : null;
  const aggregatedHistory = aggregatePastHistory(season.history);

  return (
    <div className={sectionCard('overflow-hidden p-0')}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-1 py-5 text-left transition-colors hover:bg-[var(--knu-background-alt)]/80"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-[1.05rem] font-bold leading-none text-[var(--knu-text-primary)]">
            {season.name}
          </h3>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-5 w-5 text-[var(--knu-text-tertiary)]" />
          </motion.div>
        </div>

        {success ? (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-bold text-green-700">매칭 성공</span>
            </div>
            {season.matchedWith && (
              <p className="pl-6 text-xs text-green-800">
                <span className="font-bold">{season.matchedWith}</span>님과 매칭되었어요
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-bold text-gray-700">매칭 미성사</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <SummaryStat
            icon={<Inbox className="h-4 w-4 text-purple-600" />}
            label="받은 요청"
            value={season.receivedCount}
            iconTone="bg-purple-100"
            valueTone="text-purple-600"
          />
          <SummaryStat
            icon={<Send className="h-4 w-4 text-blue-600" />}
            label="보낸 요청"
            value={season.sentCount}
            iconTone="bg-blue-100"
            valueTone="text-blue-600"
          />
          <SummaryStat
            icon={<MessageCircle className="h-4 w-4 text-green-600" />}
            label="대화"
            value={season.chatCount}
            iconTone="bg-green-100"
            valueTone="text-green-600"
          />
        </div>
        {dormitoryName && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[var(--knu-text-secondary)]">
              <Building2 className="h-3.5 w-3.5 text-[var(--knu-text-tertiary)]" />
              {dormitoryName}
            </span>
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t-2 border-[var(--knu-border)] pb-5 pt-2">
              {aggregatedHistory.length > 0 ? (
                aggregatedHistory.map((item) => {
                  const historyMeta =
                    item.aggregateCount && item.aggregateCount >= 2 && item.aggregateContext
                      ? getRepeatedCancelledVisualMeta(item.aggregateContext, item.aggregateCount)
                      : getPastHistoryVisualMeta(item.item);
                  return (
                    <MatchingCompactCard
                      key={item.item.id}
                      nickname={item.item.nickname}
                      dormitoryId={null}
                      matchScore={0}
                      scoreType="gated"
                      hideScore
                      hoverEffect={false}
                      statusPulse={false}
                      borderColor={historyMeta.borderColor ?? matchingHistoryCardBorder}
                      opacity={0.75}
                      status={historyMeta.status}
                      statusPills={historyMeta.stagePill ? [historyMeta.stagePill] : undefined}
                    />
                  );
                })
              ) : (
                <p className="py-4 text-center text-sm text-[var(--knu-text-tertiary)]">
                  이력이 없어요
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AggregatedPastHistoryItem {
  item: HistoryItemData;
  aggregateCount?: number;
  aggregateContext?: 'SENT_REQUEST' | 'RECEIVED_REQUEST';
}

function aggregatePastHistory(history: HistoryItemData[]): AggregatedPastHistoryItem[] {
  const rows: AggregatedPastHistoryItem[] = [];
  const seen = new Map<string, AggregatedPastHistoryItem>();

  for (const item of history) {
    const isSentCancelled =
      'status' in item &&
      item.status === 'CANCELLED' &&
      item.stage === 'SENT_REQUEST' &&
      item.resolvedBy === 'self';
    const isReceivedCancelled =
      ('status' in item &&
        item.status === 'CANCELLED' &&
        item.stage === 'RECEIVED_REQUEST' &&
        item.resolvedBy === 'other') ||
      (!('status' in item) && item.preset === 'RECEIVED_CANCELLED');

    if (isSentCancelled || isReceivedCancelled) {
      const context = isSentCancelled ? 'SENT_REQUEST' : 'RECEIVED_REQUEST';
      const key = `cancelled:${context}:${item.nickname}`;
      const existing = seen.get(key);
      if (existing) {
        existing.aggregateCount = (existing.aggregateCount ?? 1) + 1;
        continue;
      }

      const row: AggregatedPastHistoryItem = {
        item,
        aggregateCount: 1,
        aggregateContext: context,
      };
      seen.set(key, row);
      rows.push(row);
      continue;
    }

    rows.push({ item });
  }

  return rows;
}
