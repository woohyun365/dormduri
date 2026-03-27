'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, AlertTriangle, Sparkles } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { calcSeasonDates } from '@/constants/season';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

interface HomeSeasonBannerProps {
  isUnassigned?: boolean;
}

export function HomeSeasonBanner({ isUnassigned = false }: HomeSeasonBannerProps) {
  const { season, state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();

  const roomSelectionDateStr = useMemo(
    () => formatDate(season.roomSelectionDate),
    [season.roomSelectionDate],
  );

  // 시즌 매칭 진행률 (0~100)
  const progressPercent = useMemo(() => {
    if (!isMatching) return 0;
    const { matchStart, matchEnd } = calcSeasonDates(season.roomSelectionDate);
    const start = new Date(matchStart + 'T00:00:00+09:00').getTime();
    const end = new Date(matchEnd + 'T23:59:59+09:00').getTime();
    const total = end - start;
    if (total <= 0) return 100;
    // daysUntilEnd는 서버/context에서 제공되므로 이를 기반으로 역산
    const elapsed = total - daysUntilEnd * 24 * 60 * 60 * 1000;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [isMatching, season.roomSelectionDate, daysUntilEnd]);

  const title =
    seasonState === 'SEASON_MATCHING'
      ? daysUntilEnd <= 3
        ? '매칭 시즌 마감 임박'
        : '매칭 시즌 진행중'
      : seasonState === 'SEASON_OPEN'
        ? '시즌 오픈'
        : '비시즌';

  const dotColor =
    seasonState === 'SEASON_MATCHING'
      ? 'bg-green-500'
      : seasonState === 'SEASON_OPEN'
        ? 'bg-blue-500'
        : 'bg-gray-400';

  const bannerStyle =
    seasonState === 'SEASON_MATCHING'
      ? daysUntilEnd <= 3
        ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
        : daysUntilEnd <= 7
          ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
          : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'
      : seasonState === 'SEASON_OPEN'
        ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
        : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 p-5 ${bannerStyle}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${dotColor}`} />
          <h3 className="font-bold text-[var(--knu-text-primary)]">{title}</h3>
        </div>
        <Calendar className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>
      <p className="text-sm text-[var(--knu-text-secondary)] mb-3">{season.name}</p>

      {seasonState === 'SEASON_MATCHING' && isUnassigned ? (
        <div className="space-y-3">
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900 mb-1">
                  건물을 선택하면 매칭을 시작할 수 있어요
                </p>
                <p className="text-xs text-orange-700">
                  프로필 탭에서 배정 건물을 설정해주세요.
                  <br />
                  건물 선택 후에는 프로필 수정이 제한됩니다.
                </p>
              </div>
            </div>
          </div>
          <DeadlineRow dateStr={roomSelectionDateStr} daysUntilEnd={daysUntilEnd} />
        </div>
      ) : seasonState === 'SEASON_MATCHING' ? (
        <div className="space-y-3">
          {/* 진행 바 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--knu-text-tertiary)]">시즌 진행률</span>
              <span className="text-xs font-semibold text-[var(--knu-text-secondary)]">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  daysUntilEnd <= 3
                    ? 'bg-red-500'
                    : daysUntilEnd <= 7
                      ? 'bg-amber-500'
                      : 'bg-[var(--knu-primary)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 호실 선택일 + D-Day */}
          <DeadlineRow dateStr={roomSelectionDateStr} daysUntilEnd={daysUntilEnd} />

          {/* D-3 종료 임박 안내 */}
          {daysUntilEnd <= 3 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-800 mb-0.5">시즌 종료 임박</p>
                <p className="text-xs text-red-700">
                  미확정 매칭 신청은 시즌 종료 시 자동 취소됩니다. 확정된 매칭도 초기화됩니다.
                </p>
              </div>
            </div>
          )}

          {/* D-7 종료 예정 안내 (D-3 아닐 때) */}
          {daysUntilEnd > 3 && daysUntilEnd <= 7 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                시즌 종료가 {daysUntilEnd}일 남았습니다. 매칭을 서둘러 확정하세요.
              </p>
            </div>
          )}
        </div>
      ) : seasonState === 'SEASON_OPEN' ? (
        <div className="space-y-3">
          {isUnassigned ? (
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-900 mb-1">
                    건물을 선택하면 룸메 탐색을 시작할 수 있어요
                  </p>
                  <p className="text-xs text-orange-700">프로필 탭에서 배정 건물을 설정해주세요.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">매칭 준비 기간이에요</p>
                  <p className="text-xs text-blue-700">
                    프로필을 완성하고 룸메 후보를 탐색·북마크해두세요.
                    <br />
                    매칭 시작 후에는 프로필 수정이 제한됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <span className="font-semibold">호실 선택일:</span>
            <span>{roomSelectionDateStr}</span>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-[var(--knu-text-primary)] mb-1">
            지금은 비시즌이에요
          </p>
          <p className="text-xs text-[var(--knu-text-secondary)]">
            프로필을 미리 완성해두면 다음 시즌에 바로 매칭을 시작할 수 있어요.
          </p>
        </div>
      )}
    </motion.div>
  );
}

// --- Figma 스타일 마감일 표시 ---

function DeadlineRow({ dateStr, daysUntilEnd }: { dateStr: string; daysUntilEnd: number }) {
  const isUrgent = daysUntilEnd <= 3;
  const isWarning = daysUntilEnd > 3 && daysUntilEnd <= 7;

  const textColor = isUrgent ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700';
  const badgeStyle = isUrgent
    ? 'bg-red-500 text-white'
    : isWarning
      ? 'bg-amber-500 text-white'
      : 'bg-blue-500 text-white';

  return (
    <div className={`flex items-center gap-2 text-xs ${textColor}`}>
      <span className="font-semibold">마감일:</span>
      <span>{dateStr}</span>
      <span className={`px-2 py-0.5 ${badgeStyle} rounded-full font-bold`}>D-{daysUntilEnd}</span>
    </div>
  );
}
