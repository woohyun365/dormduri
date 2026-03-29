'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, AlertTriangle, Info } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { calcSeasonDates } from '@/constants/season';
import { calcDaysUntilKstDate, formatDateSpaced, formatMonthDay } from '@/utils/date';

interface HomeSeasonBannerProps {
  isUnassigned?: boolean;
  hasActiveMatch?: boolean;
  children?: React.ReactNode;
}

export function HomeSeasonBanner({
  isUnassigned = false,
  hasActiveMatch = false,
  children,
}: HomeSeasonBannerProps) {
  const [renderedAt] = useState(() => Date.now());
  const { season, state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();

  const dates = useMemo(() => {
    const { openStart, matchStart, matchEnd } = calcSeasonDates(season.roomSelectionDate);
    return {
      openStart,
      matchStart,
      matchEnd,
      openStartFormatted: formatDateSpaced(openStart),
      matchStartFormatted: formatDateSpaced(matchStart),
      matchPeriod: `${formatMonthDay(matchStart)} ~ ${formatMonthDay(matchEnd)}`,
      roomSelectionFormatted: formatDateSpaced(season.roomSelectionDate),
      daysUntilOpenStart: calcDaysUntilKstDate(openStart, renderedAt),
      daysUntilMatchStart: calcDaysUntilKstDate(matchStart, renderedAt),
      isNextSeasonRegistered: new Date(`${openStart}T00:00:00+09:00`).getTime() > renderedAt,
    };
  }, [renderedAt, season.roomSelectionDate]);

  const progressPercent = useMemo(() => {
    if (!isMatching) return 0;
    const start = new Date(`${dates.matchStart}T00:00:00+09:00`).getTime();
    const end = new Date(`${dates.matchEnd}T23:59:59+09:00`).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = total - daysUntilEnd * 24 * 60 * 60 * 1000;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [daysUntilEnd, dates.matchEnd, dates.matchStart, isMatching]);

  const dayColor =
    daysUntilEnd <= 3
      ? { bg: 'bg-red-500', text: 'text-red-700' }
      : daysUntilEnd <= 7
        ? { bg: 'bg-amber-500', text: 'text-amber-700' }
        : { bg: 'bg-blue-500', text: 'text-blue-700' };

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

  const endWarning =
    daysUntilEnd <= 3
      ? hasActiveMatch
        ? {
            title: '호실 선택 준비 안내',
            body: '매칭이 확정되었어요. 호실 선택은 학교 시스템에서 직접 진행해 주세요.',
          }
        : {
            title: '시즌 종료 임박',
            body: `${daysUntilEnd}일 후 매칭이 종료돼요. 미결 요청은 자동 취소되기 전에 확인해보세요.`,
          }
      : {
          title: '시즌 종료 예정',
          body: `${daysUntilEnd}일 후 매칭이 종료됩니다. 매칭을 마무리해보세요.`,
        };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r ${bannerStyle.gradient} border-2 ${bannerStyle.border} rounded-2xl p-4 keep-all`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${bannerStyle.dot}`} />
          <h3 className="font-bold text-[var(--knu-text-primary)]">{title}</h3>
        </div>
        <Calendar className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>

      <p className="text-sm text-[var(--knu-text-secondary)] mb-3">{seasonLabel}</p>

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
              {endWarning.title}
            </p>
            <p className={`text-xs ${daysUntilEnd <= 3 ? 'text-red-700' : 'text-amber-700'}`}>
              {endWarning.body}
            </p>
          </div>
        </motion.div>
      )}

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

      <div className="space-y-1.5">
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

        {seasonState === 'OFF_SEASON' && dates.isNextSeasonRegistered && (
          <>
            <DateRow
              label="시즌 오픈"
              value={dates.openStartFormatted}
              textColor="text-blue-700"
              badge={{ label: `D-${dates.daysUntilOpenStart}`, bgColor: 'bg-blue-500' }}
            />
            <DateRow
              label="매칭 시작"
              value={dates.matchStartFormatted}
              textColor="text-blue-700"
              badge={{ label: `D-${dates.daysUntilMatchStart}`, bgColor: 'bg-blue-500' }}
            />
          </>
        )}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
}

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
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--knu-text-secondary)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${textColor}`}>{value}</span>
        {badge && (
          <span
            className={`px-1.5 py-0.5 ${badge.bgColor} text-white text-[10px] font-bold rounded-full`}
          >
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
