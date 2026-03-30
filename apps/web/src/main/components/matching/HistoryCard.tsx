'use client';

import { Clock } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { MATCH_STATUS_LABELS } from '@/constants/match';
import {
  matchingBorder,
  matchingCardShell,
  matchingChip,
  matchingDisplayTitle,
  matchingEyebrow,
  type MatchingTone,
} from '@/main/styles/matching';
import type { MatchStatus } from '@/types/match';

export interface HistoryCardProps {
  nickname: string;
  status: MatchStatus;
  date: string;
}

const STATUS_TONE: Partial<Record<MatchStatus, MatchingTone>> = {
  EXPIRED: 'slate',
  REJECTED: 'rose',
  CANCELLED: 'amber',
  CONVERSATION_ENDED: 'cobalt',
  UNMATCHED: 'purple',
};

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

export function HistoryCard({ nickname, status, date }: HistoryCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const tone = STATUS_TONE[status] ?? 'slate';

  return (
    <div
      className={`${matchingCardShell} ${matchingBorder(tone)} bg-white/70 p-4 opacity-75 transition-all hover:translate-y-[-1px] hover:opacity-100`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0 ring-2 ring-white`}
        >
          {nickname.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <p className={matchingEyebrow(tone)}>이전 기록</p>
          <h4 className={`${matchingDisplayTitle} mt-0.5 truncate text-[1.15rem] leading-none`}>
            {nickname}
          </h4>
          <div className="mt-2">
            <span className={matchingChip(tone)}>{MATCH_STATUS_LABELS[status]}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-xs text-[var(--knu-text-tertiary)]">
          <Clock className="h-3 w-3" />
          {formatRelativeDate(date)}
        </div>
      </div>
    </div>
  );
}
