'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, AlertTriangle, Info, Megaphone } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { calcSeasonDates } from '@/constants/season';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}. ${d.getDate()}`;
}

function calcDaysFromNow(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00+09:00').getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
}

interface HomeSeasonBannerProps {
  isUnassigned?: boolean;
  children?: React.ReactNode;
}

export function HomeSeasonBanner({ isUnassigned = false, children }: HomeSeasonBannerProps) {
  const { season, state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();

  const dates = useMemo(() => {
    const { openStart, matchStart, matchEnd } = calcSeasonDates(season.roomSelectionDate);
    return {
      openStart,
      matchStart,
      matchEnd,
      openStartFormatted: formatDate(openStart),
      matchStartFormatted: formatDate(matchStart),
      matchPeriod: `${formatShortDate(matchStart)} ~ ${formatShortDate(matchEnd)}`,
      roomSelectionFormatted: formatDate(season.roomSelectionDate),
      daysUntilOpenStart: calcDaysFromNow(openStart),
      daysUntilMatchStart: calcDaysFromNow(matchStart),
      isNextSeasonRegistered: new Date(openStart + 'T00:00:00+09:00').getTime() > Date.now(),
    };
  }, [season.roomSelectionDate]);

  const progressPercent = useMemo(() => {
    if (!isMatching) return 0;
    const start = new Date(dates.matchStart + 'T00:00:00+09:00').getTime();
    const end = new Date(dates.matchEnd + 'T23:59:59+09:00').getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = total - daysUntilEnd * 24 * 60 * 60 * 1000;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [isMatching, dates.matchStart, dates.matchEnd, daysUntilEnd]);

  // D-Day 색상
  const dayColor =
    daysUntilEnd <= 3
      ? { bg: 'bg-red-500', text: 'text-red-700' }
      : daysUntilEnd <= 7
        ? { bg: 'bg-amber-500', text: 'text-amber-700' }
        : { bg: 'bg-blue-500', text: 'text-blue-700' };

  // 배너 스타일
  const bannerStyle =
    seasonState === 'SEASON_MATCHING'
      ? daysUntilEnd <= 3
        ? { gradient: 'from-red-50 to-orange-50', border: 'border-red-200', dot: 'bg-red-500' }
        : daysUntilEnd <= 7
          ? {
              gradient: 'from-amber-50 to-yellow-50',
              border: 'border-amber-200',
              dot: 'bg-amber-500',
            }
          : {
              gradient: 'from-blue-50 to-purple-50',
              border: 'border-blue-200',
              dot: 'bg-green-500',
            }
      : seasonState === 'SEASON_OPEN'
        ? { gradient: 'from-cyan-50 to-blue-50', border: 'border-cyan-200', dot: 'bg-blue-500' }
        : { gradient: 'from-slate-100 to-blue-50', border: 'border-slate-200', dot: 'bg-gray-400' };

  const title =
    seasonState === 'SEASON_MATCHING'
      ? daysUntilEnd <= 3
        ? '매칭 시즌 마감 임박'
        : '매칭 시즌 진행중'
      : seasonState === 'SEASON_OPEN'
        ? '시즌 오픈'
        : '비시즌';

  const seasonLabel =
    seasonState === 'SEASON_MATCHING'
      ? `${season.name} 룸메이트 매칭 시즌`
      : seasonState === 'SEASON_OPEN'
        ? `${season.name} 매칭 준비 기간`
        : dates.isNextSeasonRegistered
          ? `${season.name} 시즌 오픈 준비중`
          : `${season.name} 룸메이트 매칭 시즌 종료`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r ${bannerStyle.gradient} border-2 ${bannerStyle.border} rounded-2xl p-4 keep-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${bannerStyle.dot}`} />
          <h3 className="font-bold text-[var(--knu-text-primary)]">{title}</h3>
        </div>
        <Calendar className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>

      {/* Subtitle */}
      <p className="text-sm text-[var(--knu-text-secondary)] mb-3">{seasonLabel}</p>

      {/* Progress Bar — SEASON_MATCHING only */}
      {seasonState === 'SEASON_MATCHING' && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--knu-text-tertiary)]">시즌 진행률</span>
            <span className="text-xs font-bold text-[var(--knu-primary)]">{progressPercent}%</span>
          </div>
          <div className="relative h-2 bg-white/60 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 ${dayColor.bg} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Warning — No Building */}
      {seasonState === 'SEASON_MATCHING' && isUnassigned && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-900 mb-0.5">
              건물을 선택하면 매칭을 시작할 수 있어요
            </p>
            <p className="text-xs text-amber-700">프로필 탭에서 배정 건물을 설정해주세요.</p>
          </div>
        </motion.div>
      )}

      {/* Warning — D-7 / D-3 (glassmorphism) */}
      {seasonState === 'SEASON_MATCHING' && !isUnassigned && daysUntilEnd <= 7 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`backdrop-blur-md shadow-sm rounded-xl p-3 mb-3 flex items-start gap-2 ${
            daysUntilEnd <= 3
              ? 'bg-red-100/50 border border-red-300/60'
              : 'bg-amber-100/50 border border-amber-300/60'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 ${daysUntilEnd <= 3 ? 'text-red-600' : 'text-amber-600'} flex-shrink-0 mt-0.5`}
          />
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-semibold ${daysUntilEnd <= 3 ? 'text-red-900' : 'text-amber-900'}`}
            >
              {daysUntilEnd <= 3 ? '시즌 종료 임박' : '시즌 종료 예정'}
            </p>
            <p className={`text-xs ${daysUntilEnd <= 3 ? 'text-red-700' : 'text-amber-700'}`}>
              {daysUntilEnd}일 후 매칭이 종료됩니다. 매칭을 마무리해보세요.
            </p>
          </div>
        </motion.div>
      )}

      {/* Info — SEASON_OPEN */}
      {seasonState === 'SEASON_OPEN' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${
            isUnassigned ? 'bg-amber-50 border-amber-200' : 'bg-cyan-50 border-cyan-200'
          } border rounded-xl p-3 mb-3 flex items-start gap-2`}
        >
          {isUnassigned ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-900 mb-0.5">
                  건물을 선택하면 룸메 탐색을 시작할 수 있어요
                </p>
                <p className="text-xs text-amber-700">프로필 탭에서 배정 건물을 설정해주세요.</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">✨</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-cyan-900 mb-0.5">매칭 준비 기간이에요</p>
                <p className="text-xs text-cyan-700">프로필을 완성하고 룸메 후보를 탐색해보세요.</p>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Info — OFF_SEASON (glassmorphism) */}
      {seasonState === 'OFF_SEASON' && (
        <div className="backdrop-blur-md bg-blue-100/40 border border-blue-200/60 rounded-xl p-3 mb-3 shadow-sm">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 font-medium leading-relaxed">
              프로필을 미리 완성해두면 다음 시즌에 바로 매칭을 시작할 수 있어요
            </p>
          </div>
        </div>
      )}

      {/* Date Information */}
      <div className="space-y-1.5">
        {/* SEASON_MATCHING */}
        {seasonState === 'SEASON_MATCHING' && (
          <>
            <DateRow label="매칭 기간" value={dates.matchPeriod} textColor={dayColor.text} />
            <DateRow
              label="호실 선택일"
              value={dates.roomSelectionFormatted}
              textColor={dayColor.text}
              badge={{ label: `D-${daysUntilEnd}`, bgColor: dayColor.bg }}
            />
          </>
        )}

        {/* SEASON_OPEN */}
        {seasonState === 'SEASON_OPEN' && (
          <>
            <DateRow
              label="매칭 시작"
              value={dates.matchStartFormatted}
              textColor="text-cyan-700"
              badge={{ label: `D-${dates.daysUntilMatchStart}`, bgColor: 'bg-blue-500' }}
            />
            <DateRow
              label="호실 선택일"
              value={dates.roomSelectionFormatted}
              textColor="text-cyan-700"
            />
          </>
        )}

        {/* OFF_SEASON — Next Registered */}
        {seasonState === 'OFF_SEASON' && dates.isNextSeasonRegistered && (
          <div className="space-y-1.5">
            <DateRow
              label="시즌 오픈"
              value={dates.openStartFormatted}
              textColor="text-gray-700"
              badge={{ label: `D-${dates.daysUntilOpenStart}`, bgColor: 'bg-blue-500' }}
            />
            <DateRow
              label="매칭 시작"
              value={dates.matchStartFormatted}
              textColor="text-gray-700"
              badge={{ label: `D-${dates.daysUntilMatchStart}`, bgColor: 'bg-blue-500' }}
            />
            <DateRow
              label="호실 선택일"
              value={dates.roomSelectionFormatted}
              textColor="text-gray-700"
            />
          </div>
        )}

        {/* OFF_SEASON — Not Registered */}
        {seasonState === 'OFF_SEASON' && !dates.isNextSeasonRegistered && (
          <div className="flex items-center justify-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-xs text-gray-600">다음 시즌 일정이 등록되면 안내해드릴게요</p>
          </div>
        )}
      </div>

      {/* BuildingStatsBar (시각적 병합) */}
      {children && (
        <>
          <div className="mx-2 border-t border-black/10 my-3" />
          <p className="text-xs font-semibold text-[var(--knu-text-tertiary)] mb-2">
            {seasonState === 'OFF_SEASON'
              ? '이전 시즌'
              : seasonState === 'SEASON_OPEN'
                ? '대기 현황'
                : '시즌 현황'}
          </p>
          {children}
        </>
      )}
    </motion.div>
  );
}

// --- Sub-components ---

function DateRow({
  label,
  value,
  textColor,
  badge,
}: {
  label: string;
  value: string;
  textColor: string;
  badge?: { label: string; bgColor: string };
}) {
  return (
    <div className={`flex items-center justify-between text-xs ${textColor}`}>
      <span className="font-semibold">{label}:</span>
      <div className="flex items-center gap-2">
        <span>{value}</span>
        {badge && (
          <span
            className={`${badge.bgColor} text-white px-2 py-0.5 rounded-full font-bold text-xs`}
          >
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
