'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { HistoryCard } from './HistoryCard';
import {
  matchingBorder,
  matchingCardShell,
  matchingChip,
  matchingDisplayTitle,
  matchingEyebrow,
} from '@/main/styles/matching';
import type { PastSeasonData } from '@/types/match';

interface PastSeasonAccordionProps {
  season: PastSeasonData;
  defaultExpanded?: boolean;
}

export function PastSeasonAccordion({ season, defaultExpanded = false }: PastSeasonAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const tone = season.matchResult === 'success' ? 'emerald' : 'slate';

  return (
    <div className={`${matchingCardShell} ${matchingBorder(tone)} overflow-hidden`}>
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between transition-colors hover:bg-[var(--knu-background-alt)]/80"
      >
        <div className="flex-1 text-left">
          <div className="mb-2 flex items-center gap-2">
            <div>
              <p className={matchingEyebrow(tone)}>시즌 이력</p>
              <h3 className={`${matchingDisplayTitle} mt-1 text-[1.2rem] leading-none`}>
                {season.name}
              </h3>
            </div>
            {season.matchResult === 'success' ? (
              <div className={matchingChip('emerald')}>
                <CheckCircle className="h-3 w-3" />
                매칭 성공
              </div>
            ) : (
              <div className={matchingChip('slate')}>
                <XCircle className="h-3 w-3" />
                미성사
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
            <div className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-3">
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
