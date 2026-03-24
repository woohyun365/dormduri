'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import type { Season } from '@/constants/season';

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const sm = start.getMonth() + 1;
  const em = end.getMonth() + 1;
  if (sm === em) {
    return `${sm}월 ${start.getDate()}일 ~ ${end.getDate()}일`;
  }
  return `${sm}월 ${start.getDate()}일 ~ ${em}월 ${end.getDate()}일`;
}

interface HomeSeasonBannerProps {
  season: Season;
  isSeasonActive: boolean;
}

export function HomeSeasonBanner({ season, isSeasonActive: seasonActive }: HomeSeasonBannerProps) {
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const timer = setTimeout(() => setDateKey(new Date().toDateString()), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [dateKey]);

  const { dDay, roomSelectionDateStr } = useMemo(() => {
    const today = new Date(dateKey);
    today.setHours(0, 0, 0, 0);
    const target = new Date(season.roomSelectionStart + 'T00:00:00');
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return {
      dDay: Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
      roomSelectionDateStr: formatDateRange(season.roomSelectionStart, season.roomSelectionEnd),
    };
  }, [dateKey, season.roomSelectionStart, season.roomSelectionEnd]);

  return (
    <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${seasonActive ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          <h3 className="font-bold text-[var(--knu-text-primary)]">
            {seasonActive ? '매칭 시즌 진행중' : '비시즌'}
          </h3>
        </div>
        <Calendar className="w-5 h-5 text-[var(--knu-primary)]" />
      </div>
      <p className="text-sm text-[var(--knu-text-secondary)] mb-3">{season.name}</p>
      {seasonActive ? (
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">호실 선택일</p>
            <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
              {roomSelectionDateStr}
            </p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg font-bold text-sm ${
              dDay > 0
                ? 'bg-[var(--knu-primary-light)] text-[var(--knu-primary)]'
                : dDay === 0
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-[var(--knu-text-tertiary)]'
            }`}
          >
            {dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day' : '종료'}
          </div>
        </div>
      ) : (
        <div className="bg-[var(--knu-background-alt)] rounded-xl p-3">
          <p className="text-sm text-[var(--knu-text-secondary)]">
            다음 시즌 일정이 공지되면 알려드릴게요.
          </p>
        </div>
      )}
    </div>
  );
}
