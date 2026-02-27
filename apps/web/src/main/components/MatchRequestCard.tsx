'use client';

import { Clock, X, Check } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown';
import type { MatchRequest } from '@/types/match';
import type { RoommateProfile } from '@/types/profile';

interface MatchRequestCardProps {
  request: MatchRequest;
  direction: 'sent' | 'received';
  partnerProfile: Omit<RoommateProfile, 'matchScore'> & { matchScore: number };
  onCancel?: (requestId: string) => void;
  onAccept?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
}

export function MatchRequestCard({
  request,
  direction,
  partnerProfile,
  onCancel,
  onAccept,
  onReject,
}: MatchRequestCardProps) {
  const { timeLeft, isExpired } = useExpiryCountdown(request.expiresAt);
  const avatarColor = getAvatarColor(partnerProfile.nickname);
  const dormLabel = getDormitoryLabel(partnerProfile.dormitoryId);

  return (
    <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4">
      {/* Header: avatar + info + match score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text}`}
          >
            {partnerProfile.nickname.charAt(0)}
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--knu-text-primary)]">
              {partnerProfile.nickname}
            </h4>
            {dormLabel && <p className="text-xs text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${getMatchScoreColor(partnerProfile.matchScore)}`}
        >
          매칭 {partnerProfile.matchScore}%
        </span>
      </div>

      {/* Message */}
      {request.message && (
        <p className="text-sm text-[var(--knu-text-secondary)] mb-3 leading-relaxed">
          &ldquo;{request.message}&rdquo;
        </p>
      )}

      {/* Timer — 카운트다운은 클라이언트 시각 기반이므로 hydration 차이 허용 */}
      <div className="flex items-center gap-1.5 mb-3" suppressHydrationWarning>
        <Clock className="w-3.5 h-3.5 text-[var(--knu-text-tertiary)]" />
        <span
          suppressHydrationWarning
          className={`text-xs font-semibold ${
            isExpired ? 'text-red-500' : 'text-[var(--knu-text-tertiary)]'
          }`}
        >
          {isExpired ? '만료됨' : `남은 시간 ${timeLeft}`}
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {direction === 'sent' && (
          <button
            onClick={() => onCancel?.(request.id)}
            disabled={isExpired}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isExpired
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            취소
          </button>
        )}
        {direction === 'received' && (
          <>
            <button
              onClick={() => onReject?.(request.id)}
              disabled={isExpired}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isExpired
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              거절
            </button>
            <button
              onClick={() => onAccept?.(request.id)}
              disabled={isExpired}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isExpired
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              수락
            </button>
          </>
        )}
      </div>
    </div>
  );
}
