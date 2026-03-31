'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MoreVertical, User, X, Flag, BellRing, Lock } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown';
import type { MatchScoreType } from '@/types/match';

interface SentRequestCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  message: string | null;
  expiresAt: string;
  onViewProfile: () => void;
  onCancel: () => void;
}

export function SentRequestCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  message,
  expiresAt,
  onViewProfile,
  onCancel,
}: SentRequestCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);
  const { timeLeft, isExpired, totalSeconds } = useExpiryCountdown(expiresAt);
  const isUrgent = !isExpired && totalSeconds <= 24 * 60 * 60;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  // 남은 시간 표시: 기본 Day, 24h 이내 Hour
  const getTimeDisplay = () => {
    if (isExpired) return '만료됨';
    const hours = Math.floor(totalSeconds / 3600);
    if (hours < 24) return `${hours}시간`;
    const days = Math.ceil(hours / 24);
    return `D-${days}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 overflow-visible"
    >
      {/* 1행: 아바타 + 닉네임/건물/상태 + 매칭도 */}
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className={`h-9 w-9 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0 ring-2 ring-white`}
        >
          {nickname.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[0.9rem] font-bold leading-tight text-[var(--knu-text-primary)] truncate">
            {nickname}
            {dormLabel && (
              <span className="ml-1.5 text-xs font-normal text-[var(--knu-text-tertiary)]">
                · {dormLabel}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-amber-600 font-medium">수락 대기 중</span>
            <span className="text-xs text-[var(--knu-text-tertiary)]">·</span>
            <span
              className={`text-xs font-medium flex items-center gap-0.5 ${
                isExpired
                  ? 'text-red-500'
                  : isUrgent
                    ? 'text-red-500'
                    : 'text-[var(--knu-text-tertiary)]'
              }`}
              suppressHydrationWarning
            >
              <Clock className="h-3 w-3" />
              <span suppressHydrationWarning>{getTimeDisplay()}</span>
            </span>
          </div>
        </div>

        {/* 매칭도 pill (UserCard 스타일) */}
        {scoreType === 'gated' ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-500 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            잠김
          </span>
        ) : (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${getMatchScoreColor(matchScore)}`}
          >
            매칭 {matchScore}%{scoreType === 'partial' && ' (!)'}
          </span>
        )}
      </div>

      {/* 한마디 (있을 때만) */}
      {message && (
        <div className="mb-2 rounded-lg bg-[var(--knu-background-alt)] px-3 py-2">
          <p className="text-xs text-[var(--knu-text-secondary)] line-clamp-1">
            &ldquo;{message}&rdquo;
          </p>
        </div>
      )}

      {/* 2행: 버튼 */}
      <div className="flex items-center gap-1.5">
        <motion.button
          onClick={onViewProfile}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold border border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] hover:bg-slate-50 transition-colors"
        >
          <User className="h-3.5 w-3.5" />
          프로필
        </motion.button>

        <motion.button
          onClick={onCancel}
          disabled={isExpired}
          whileTap={isExpired ? undefined : { scale: 0.97 }}
          className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            isExpired
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'border border-amber-200 text-amber-700 hover:bg-amber-50'
          }`}
        >
          <X className="h-3.5 w-3.5" />
          취소
        </motion.button>

        <div className="flex-1" />

        {/* 3점 메뉴 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-[var(--knu-text-tertiary)] hover:bg-slate-100"
            aria-label="더보기"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 top-full mt-1 z-10 rounded-xl border border-[var(--knu-border)] bg-white shadow-lg shadow-black/8 py-1 min-w-[160px]"
              >
                <button
                  onClick={() => {
                    // TODO: 수락 시 알림 설정 (Sprint 7 BE 연동 후)
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-[var(--knu-text-secondary)] flex items-center gap-2.5 opacity-50 cursor-not-allowed"
                  disabled
                >
                  <BellRing className="h-4 w-4 text-[var(--knu-text-tertiary)]" />
                  수락 시 알림 설정
                  <span className="ml-auto text-[10px] text-[var(--knu-text-tertiary)]">
                    준비 중
                  </span>
                </button>
                <div className="mx-3 my-0.5 border-t border-[var(--knu-border)]" />
                <button
                  onClick={() => {
                    // TODO: 신고 기능
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                >
                  <Flag className="h-4 w-4" />
                  신고하기
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
