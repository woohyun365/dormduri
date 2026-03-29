'use client';

import { Clock } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { MATCH_STATUS_LABELS } from '@/constants/match';
import type { MatchStatus } from '@/types/match';

export interface HistoryCardProps {
  nickname: string;
  status: MatchStatus;
  date: string;
}

const STATUS_STYLE: Partial<Record<MatchStatus, string>> = {
  EXPIRED: 'bg-gray-100 text-gray-600 border-gray-200',
  REJECTED: 'bg-red-50 text-red-600 border-red-200',
  CANCELLED: 'bg-orange-50 text-orange-600 border-orange-200',
  CONVERSATION_ENDED: 'bg-blue-50 text-blue-600 border-blue-200',
  UNMATCHED: 'bg-purple-50 text-purple-600 border-purple-200',
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
  const style = STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="bg-white/40 backdrop-blur-sm border border-[var(--knu-border)]/60 rounded-xl p-4 opacity-60 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0`}
        >
          {nickname.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--knu-text-primary)] mb-1 truncate">{nickname}</h4>
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md border ${style}`}
          >
            {MATCH_STATUS_LABELS[status]}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-[var(--knu-text-tertiary)] flex-shrink-0">
          <Clock className="w-3 h-3" />
          {formatRelativeDate(date)}
        </div>
      </div>
    </div>
  );
}
