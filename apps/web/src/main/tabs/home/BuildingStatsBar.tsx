'use client';

import { motion } from 'motion/react';
import { AlertTriangle, Link as LinkIcon, Megaphone, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { SeasonState } from '@/types/season';

type Urgency = 'normal' | 'warning' | 'critical';

interface BuildingStatsBarProps {
  seasonState: SeasonState;
  hasBuilding: boolean;
  buildingName?: string;
  totalCount: number;
  buildingCount: number;
  todayNewTotal: number;
  todayNewBuilding: number;
  matchSuccessCount: number;
  urgency?: Urgency;
  daysLeft?: number;
}

export function BuildingStatsBar({
  seasonState,
  hasBuilding,
  buildingName,
  totalCount,
  buildingCount,
  todayNewTotal,
  todayNewBuilding,
  matchSuccessCount,
  urgency = 'normal',
  daysLeft,
}: BuildingStatsBarProps) {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success('링크가 복사되었어요!', { duration: 2000 });
    } catch {
      toast.error('링크 복사에 실패했어요');
    }
  };

  // OFF_SEASON: glassmorphism 2열 카드
  if (seasonState === 'OFF_SEASON') {
    return (
      <>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="backdrop-blur-md bg-white/40 border border-white/60 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-1 text-xs text-[var(--knu-text-tertiary)] mb-1">
              <Users className="w-3 h-3" />
              <span>전체 참여</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--knu-primary)]">{totalCount}</span>
              <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
            </div>
          </div>

          <div className="backdrop-blur-md bg-purple-100/40 border border-purple-200/50 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-1 text-xs text-purple-600 font-medium mb-1">
              <Sparkles className="w-3 h-3" />
              <span>매칭 성공</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-purple-600">{matchSuccessCount}</span>
              <span className="text-sm text-purple-600">명</span>
            </div>
          </div>
        </div>

        <CopyLinkButton onClick={handleCopyLink} />
      </>
    );
  }

  // SEASON_MATCHING / SEASON_OPEN
  const isMatching = seasonState === 'SEASON_MATCHING';
  const label = isMatching ? '참여' : '대기';

  // 건물 카드 스타일: critical → glassmorphism
  const buildingCardClass = (() => {
    if (seasonState === 'SEASON_OPEN')
      return 'backdrop-blur-md bg-blue-100/50 border border-blue-300/60 shadow-sm';
    if (urgency === 'critical')
      return 'backdrop-blur-md bg-white/40 border border-white/60 shadow-sm';
    return 'bg-blue-50 border border-blue-200';
  })();

  return (
    <>
      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="backdrop-blur-md bg-white/40 border border-white/60 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1 text-xs text-[var(--knu-text-tertiary)] mb-1">
            <Users className="w-3 h-3" />
            <span>전체 {label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--knu-text-primary)]">{totalCount}</span>
            <span className="text-sm text-[var(--knu-text-secondary)]">명</span>
            {todayNewTotal > 0 && (
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-xs font-bold text-green-600 ml-1"
              >
                (+{todayNewTotal})
              </motion.span>
            )}
          </div>
        </div>

        {hasBuilding ? (
          <div className={`rounded-xl p-3 ${buildingCardClass}`}>
            <div className="flex items-center gap-1 text-xs text-blue-600 font-medium mb-1">
              <Users className="w-3 h-3" />
              <span>
                {buildingName} {label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-600">{buildingCount}</span>
              <span className="text-sm text-blue-600">명</span>
              {todayNewBuilding > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs font-bold text-green-600 ml-1"
                >
                  (+{todayNewBuilding})
                </motion.span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-amber-700 font-medium mb-1">
              <Users className="w-3 h-3" />
              <span>내 건물</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-bold text-amber-800">건물 미배정</span>
            </div>
          </div>
        )}
      </div>

      {/* 매칭 성공 — urgency 기반 (SEASON_MATCHING만) */}
      {isMatching && matchSuccessCount > 0 && (
        <MatchSuccessText count={matchSuccessCount} urgency={urgency} daysLeft={daysLeft} />
      )}

      <CopyLinkButton onClick={handleCopyLink} />
    </>
  );
}

// --- 매칭 성공 텍스트 (urgency 분기) ---

function MatchSuccessText({
  count,
  urgency,
  daysLeft,
}: {
  count: number;
  urgency: Urgency;
  daysLeft?: number;
}) {
  // 속도: normal/warning 2.5s, critical 3s (차분하게)
  const speed = urgency === 'critical' ? 3 : 2.5;

  // 색상 테마
  const textColor =
    urgency === 'critical'
      ? 'text-red-900'
      : urgency === 'warning'
        ? 'text-amber-950'
        : 'text-indigo-900/80';

  const numberColors =
    urgency === 'critical'
      ? ['#e11d48', '#9f1239', '#e11d48'] // rose-600↔rose-800
      : ['#9333ea', '#6b21a8', '#9333ea']; // purple-600↔purple-800

  const glowColors =
    urgency === 'critical'
      ? [
          '0 0 8px rgba(225, 29, 72, 0)',
          '0 0 10px rgba(225, 29, 72, 0.15)',
          '0 0 8px rgba(225, 29, 72, 0)',
        ]
      : [
          '0 0 8px rgba(147, 51, 234, 0)',
          '0 0 12px rgba(147, 51, 234, 0.2)',
          '0 0 8px rgba(147, 51, 234, 0)',
        ];

  const pillBg =
    urgency === 'critical' ? 'bg-white/60' : urgency === 'warning' ? 'bg-white/50' : 'bg-white/40';

  const numberBaseColor = urgency === 'critical' ? 'text-rose-600' : 'text-purple-600';

  return (
    <motion.p
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0, scale: [1, 1.015, 1, 1.01, 1] }}
      transition={{
        opacity: { duration: 0.5 },
        y: { duration: 0.5 },
        scale: { duration: speed, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
      }}
      className={`text-sm font-medium ${textColor} mb-3 px-1 origin-left`}
    >
      {urgency === 'critical' ? (
        <>
          <Megaphone className="w-3.5 h-3.5 inline-block align-text-bottom mr-1" />
          시즌 종료까지 {daysLeft}일!{' '}
          <motion.span
            animate={{ color: numberColors, textShadow: glowColors }}
            transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
            className={`text-base font-extrabold ${numberBaseColor}`}
          >
            {count}명
          </motion.span>
          의 룸메가 매칭되었어요
        </>
      ) : urgency === 'warning' ? (
        <>
          <Megaphone className="w-3.5 h-3.5 inline-block align-text-bottom mr-1" />
          시즌 종료까지 {daysLeft}일!{' '}
          <motion.span
            animate={{ color: numberColors, textShadow: glowColors }}
            transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
            className={`text-base font-extrabold ${numberBaseColor}`}
          >
            {count}명
          </motion.span>
          의 룸메가 매칭되었어요
        </>
      ) : (
        <>
          <Megaphone className="w-3.5 h-3.5 inline-block align-text-bottom mr-1" />
          이번 시즌, 벌써{' '}
          <motion.span
            animate={{ color: numberColors, textShadow: glowColors }}
            transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
            className={`text-base font-extrabold ${numberBaseColor} `}
          >
            {count}명
          </motion.span>
          이 딱 맞는 룸메를 찾았어요!
        </>
      )}
    </motion.p>
  );
}

function CopyLinkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-center text-xs text-[var(--knu-text-tertiary)] hover:text-[var(--knu-text-secondary)] py-2 transition-colors"
    >
      <p className="mb-1">주변에 룸메를 구하는 친구가 있다면 서비스를 공유해보세요!</p>
      <span className="inline-flex items-center gap-1 font-medium">
        <LinkIcon className="w-3 h-3" />
        링크 복사
      </span>
    </button>
  );
}
