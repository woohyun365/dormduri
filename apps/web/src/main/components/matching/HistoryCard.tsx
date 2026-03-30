'use client';

import { Clock } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { MATCH_STATUS_LABELS } from '@/constants/match';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import {
  matchingBorder,
  matchingCardShell,
  matchingChip,
  type MatchingTone,
} from '@/main/styles/matching';
import type { MatchStatus } from '@/types/match';

export interface HistoryCardProps {
  nickname: string;
  status: MatchStatus;
  date: string;
  dormitoryId?: string | null;
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

export function HistoryCard({ nickname, status, date, dormitoryId }: HistoryCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const tone = STATUS_TONE[status] ?? 'slate';
  const dormLabel = dormitoryId ? getDormitoryLabel(dormitoryId) : null;

  return (
    <div
      className={`${matchingCardShell} ${matchingBorder(tone)} bg-white/70 px-4 py-3 opacity-75 transition-all hover:translate-y-[-1px] hover:opacity-100`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0 ring-2 ring-white`}
        >
          {nickname.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          {/* 1행: 닉네임 + 상태 chip */}
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-[var(--knu-text-primary)] truncate text-[0.95rem] leading-none">
              {nickname}
            </h4>
            <span className={matchingChip(tone)}>{MATCH_STATUS_LABELS[status]}</span>
          </div>
          {/* 2행: 건물 (선택적) */}
          {dormLabel && <p className="mt-1 text-xs text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1 text-xs text-[var(--knu-text-tertiary)]">
          <Clock className="h-3 w-3" />
          {formatRelativeDate(date)}
        </div>
      </div>
    </div>
  );
}
