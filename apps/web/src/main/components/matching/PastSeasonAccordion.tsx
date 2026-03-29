'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { HistoryCard } from './HistoryCard';
import type { PastSeasonData } from '@/types/match';

interface PastSeasonAccordionProps {
  season: PastSeasonData;
  defaultExpanded?: boolean;
}

export function PastSeasonAccordion({ season, defaultExpanded = false }: PastSeasonAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--knu-background-alt)] transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-[var(--knu-text-primary)]">{season.name}</h3>
            {season.matchResult === 'success' ? (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span className="text-xs font-bold text-green-600">매칭 성공</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full">
                <XCircle className="w-3 h-3 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">미성사</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--knu-text-tertiary)]">
            <span>받은 {season.receivedCount}</span>
            <span>·</span>
            <span>보낸 {season.sentCount}</span>
            <span>·</span>
            <span>대화 {season.chatCount}</span>
            {season.matchResult === 'success' && season.matchedWith && (
              <>
                <span>·</span>
                <span className="text-green-600 font-medium">{season.matchedWith}</span>
              </>
            )}
          </div>
        </div>

        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
        </motion.div>
      </button>

      {/* 내용 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 space-y-3 border-t-2 border-[var(--knu-border)]">
              {season.history.length > 0 ? (
                season.history.map((item) => (
                  <HistoryCard
                    key={item.id}
                    nickname={item.nickname}
                    status={item.status}
                    date={item.date}
                  />
                ))
              ) : (
                <p className="text-sm text-[var(--knu-text-tertiary)] text-center py-4">
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
