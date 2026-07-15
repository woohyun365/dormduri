'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MoreVertical, Lock, Clock, MessageSquare } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import type { MatchScoreType } from '@/types/match';

// --- Types ---

export interface CardPill {
  label: string;
  icon?: React.ReactNode;
  /** Tailwind bg + text 클래스 (예: 'bg-red-500 text-white') */
  className: string;
}

export interface StatusIndicator {
  label: string;
  color: string;
  dotColor?: string;
}

export interface CardAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'disabled';
}

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'disabled';
  suffix?: string;
}

export interface MatchingCompactCardProps {
  nickname: string;
  dormitoryId: string | null;
  matchScore: number;
  scoreType: MatchScoreType;

  /** 테두리 색상 */
  borderColor?: string;
  /** 카드 투명도 (이력용) */
  opacity?: number;
  /** 카드 hover/tap 인터랙션 여부 */
  hoverEffect?: boolean;
  /** 매칭도 pill 숨김 */
  hideScore?: boolean;

  /** 닉네임 상단 pill 배열 (추천 매칭, New, D-3, 확정 0/2 등) */
  pills?: CardPill[];

  /** 상태 표시 (닉네임 하단) */
  status: StatusIndicator;
  /** 상태 dot pulse 여부 */
  statusPulse?: boolean;
  /** 추가 상태 정보 (텍스트) */
  statusSuffix?: string;
  /** 상태 행 pill (확정 0/2, New 등) */
  statusPills?: CardPill[];

  /** 한마디 메시지 */
  message?: string | null;

  /** 만료 타이머 (메시지 하단, 버튼 상단) */
  timer?: {
    text: string;
    urgent?: boolean;
    expired?: boolean;
  };

  /** 액션 버튼 배열 */
  actions?: CardAction[];
  /** 3점 메뉴 아이템 */
  menuItems?: MenuItem[];

  /** 카드 전체 클릭 시 */
  onClick?: () => void;
}

// --- Component ---

const VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-[var(--knu-primary)] text-white font-bold',
  secondary:
    'border border-[var(--knu-border)] bg-white text-[var(--knu-text-primary)] font-semibold hover:bg-slate-50',
  danger: 'border border-rose-200 text-rose-600 font-semibold hover:bg-rose-50',
  warning: 'border border-amber-200 text-amber-700 font-semibold hover:bg-amber-50',
  disabled: 'bg-slate-100 text-slate-400 cursor-not-allowed font-semibold',
};

export function MatchingCompactCard({
  nickname,
  dormitoryId,
  matchScore,
  scoreType,
  borderColor = 'border-[var(--knu-border)]',
  opacity = 1,
  hoverEffect = true,
  hideScore = false,
  pills,
  status,
  statusPulse = true,
  statusSuffix,
  statusPills,
  message,
  timer,
  actions,
  menuItems,
  onClick,
}: MatchingCompactCardProps) {
  const avatarColor = getAvatarColor(nickname);
  const dormLabel = getDormitoryLabel(dormitoryId);

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

  const opacityClass =
    opacity < 1
      ? hoverEffect
        ? 'opacity-75 hover:opacity-100 transition-opacity'
        : 'opacity-75'
      : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverEffect ? { scale: 1.01 } : undefined}
      whileTap={hoverEffect && onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative rounded-2xl border-2 ${borderColor} backdrop-blur-sm bg-white/80 px-4 py-3 overflow-visible shadow-sm ${menuOpen ? 'z-30' : ''} ${opacityClass} ${
        onClick && hoverEffect
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all'
          : onClick
            ? 'cursor-pointer'
            : ''
      }`}
    >
      {/* pill 행 (추천 매칭, New, D-3 등) */}
      {pills && pills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {pills.map((pill, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${pill.className}`}
            >
              {pill.icon}
              {pill.label}
            </span>
          ))}
        </div>
      )}

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
          <div className="mt-0.5 flex items-start gap-1.5">
            {/* 상태 dot — 모든 활성 상태에 pulse */}
            {status.dotColor && (
              <span className="relative mt-1 flex h-2 w-2 flex-shrink-0">
                {statusPulse && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dotColor} opacity-75`}
                  />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${status.dotColor}`} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                {statusSuffix && (
                  <span className="text-xs text-[var(--knu-text-tertiary)]">{statusSuffix}</span>
                )}
              </div>
            </div>
            {statusPills && statusPills.length > 0 && (
              <div className="ml-auto flex flex-wrap justify-end gap-1">
                {statusPills.map((pill, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${pill.className}`}
                  >
                    {pill.icon}
                    {pill.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 매칭도 pill */}
        {hideScore ? null : scoreType === 'gated' ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-500 flex items-center gap-1 flex-shrink-0">
            <Lock className="w-3 h-3" />
            잠김
          </span>
        ) : (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${getMatchScoreColor(matchScore)}`}
          >
            매칭 {matchScore}%{scoreType === 'partial' && ' (!)'}
          </span>
        )}
      </div>

      {/* 한마디 */}
      {message && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-[var(--knu-background-alt)] px-3 py-2">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--knu-text-tertiary)]" />
          <p className="min-w-0 text-xs text-[var(--knu-text-secondary)] line-clamp-1">
            &ldquo;{message}&rdquo;
          </p>
        </div>
      )}

      {/* 만료 타이머 */}
      {timer && (
        <div className="flex items-center gap-1.5 mb-2" suppressHydrationWarning>
          <Clock
            className={`h-3.5 w-3.5 ${
              timer.expired
                ? 'text-red-500'
                : timer.urgent
                  ? 'text-red-500'
                  : 'text-[var(--knu-text-tertiary)]'
            }`}
          />
          <span
            suppressHydrationWarning
            className={`text-xs font-medium ${
              timer.expired
                ? 'text-red-500'
                : timer.urgent
                  ? 'text-red-500'
                  : 'text-[var(--knu-text-tertiary)]'
            }`}
          >
            {timer.text}
          </span>
        </div>
      )}

      {/* 2행: 버튼 + 3점 메뉴 */}
      {actions?.length || menuItems?.length ? (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {actions?.map((action, i) => {
            const variant = action.variant ?? 'secondary';
            const isDisabled = variant === 'disabled';
            return (
              <motion.button
                key={i}
                onClick={isDisabled ? undefined : action.onClick}
                disabled={isDisabled}
                whileTap={isDisabled ? undefined : { scale: 0.97 }}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors ${VARIANT_STYLES[variant]}`}
              >
                {action.icon}
                {action.label}
              </motion.button>
            );
          })}

          {menuItems && menuItems.length > 0 && (
            <>
              <div className="flex-1" />
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
                      className="absolute right-0 top-0 z-20 rounded-xl border border-[var(--knu-border)] bg-white py-1 shadow-lg shadow-black/8 min-w-[160px]"
                    >
                      {menuItems.map((item, i) => {
                        const isDisabled = item.variant === 'disabled';
                        return (
                          <div key={i}>
                            {i > 0 && (
                              <div className="mx-3 my-0.5 border-t border-[var(--knu-border)]" />
                            )}
                            <button
                              onClick={() => {
                                if (!isDisabled) {
                                  item.onClick();
                                  setMenuOpen(false);
                                }
                              }}
                              disabled={isDisabled}
                              className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 transition-colors ${
                                isDisabled
                                  ? 'text-[var(--knu-text-tertiary)] opacity-50 cursor-not-allowed'
                                  : item.variant === 'danger'
                                    ? 'text-rose-600 hover:bg-rose-50'
                                    : 'text-[var(--knu-text-primary)] hover:bg-slate-50'
                              }`}
                            >
                              {item.icon}
                              {item.label}
                              {item.suffix && (
                                <span className="ml-auto text-[10px] text-[var(--knu-text-tertiary)]">
                                  {item.suffix}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
