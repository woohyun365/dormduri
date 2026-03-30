'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Lock, MessageCircle, MoreVertical, User, X } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { matchingBorder, matchingCardShell } from '@/main/styles/matching';
import type { MatchScoreType } from '@/types/match';

interface ConversationCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;
  confirmApprovalCount?: number;
  confirmApprovalTotal?: number;
  viewerConfirmed?: boolean;
  partnerConfirmed?: boolean;
  onViewProfile: () => void;
  onConfirm: () => void;
  onRevokeConfirm: () => void;
  onEnd: () => void;
}

export function ConversationCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  confirmApprovalCount = 0,
  confirmApprovalTotal = 2,
  viewerConfirmed = false,
  onViewProfile,
  onConfirm,
  onRevokeConfirm,
  onEnd,
}: ConversationCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭으로 메뉴 닫기
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${matchingCardShell} ${matchingBorder('cobalt')} px-4 py-3 overflow-visible`}
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
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-[var(--knu-text-secondary)]">대화 중</span>
            <span className="text-xs text-[var(--knu-text-tertiary)]">
              · 확정 {confirmApprovalCount}/{confirmApprovalTotal}
            </span>
          </div>
        </div>

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

      {/* 2행: 버튼 */}
      <div className="flex items-center gap-1.5">
        <button
          disabled
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          채팅
        </button>

        <motion.button
          onClick={viewerConfirmed ? onRevokeConfirm : onConfirm}
          whileTap={{ scale: 0.97 }}
          className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold ${
            viewerConfirmed
              ? 'border border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)]'
              : 'bg-[var(--knu-primary)] text-white'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          {viewerConfirmed ? '확정 취소' : '확정하기'}
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
                className="absolute right-0 top-full mt-1 z-10 rounded-xl border border-[var(--knu-border)] bg-white shadow-lg shadow-black/8 py-1 min-w-[140px]"
              >
                <button
                  onClick={() => {
                    onViewProfile();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-[var(--knu-text-primary)] hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <User className="h-4 w-4 text-[var(--knu-text-tertiary)]" />
                  프로필 보기
                </button>
                <div className="mx-3 my-0.5 border-t border-[var(--knu-border)]" />
                <button
                  onClick={() => {
                    if (!viewerConfirmed) {
                      onEnd();
                      setMenuOpen(false);
                    }
                  }}
                  disabled={viewerConfirmed}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 transition-colors ${
                    viewerConfirmed
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <X className="h-4 w-4" />
                  대화 종료
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
