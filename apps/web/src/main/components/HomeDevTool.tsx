'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { UNASSIGNED_ID } from '@/constants/dormitory';
import type { SeasonState } from '@/types/season';

const SEASON_OVERRIDE_KEY = 'devpanel-season-override';
const SEASON_DATE_OVERRIDE_KEY = 'devpanel-season-date-override';
export const MATCHABLE_OVERRIDE_KEY = 'devpanel-matchable-count';

type DevSeasonStatus = 'auto' | SeasonState;

const STATUS_OPTIONS: { value: DevSeasonStatus; label: string }[] = [
  { value: 'auto', label: '자동 (날짜 기반)' },
  { value: 'SEASON_MATCHING', label: '시즌 매칭 진행중' },
  { value: 'SEASON_OPEN', label: '시즌 오픈 (준비기간)' },
  { value: 'OFF_SEASON', label: '비시즌' },
];

const DATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: '자동 (현재 mock)' },
  { value: 'next-semester', label: '다음 학기 (6개월 후)' },
  { value: 'past', label: '지난 학기 (3개월 전)' },
];

const DDAY_PRESETS = [1, 2, 3, 5, 7, 10, 14, 21, 30];
const MATCHABLE_PRESETS = [0, 1, 2, 3, 5, 10, 20];

function getIsoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function HomeDevTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<DevSeasonStatus>('auto');
  const [dateMode, setDateMode] = useState<string>('auto');
  const [daysLeft, setDaysLeft] = useState(14);
  const [forceUnassigned, setForceUnassigned] = useState(false);
  const [matchableCount, setMatchableCount] = useState<number | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    setStatus((localStorage.getItem(SEASON_OVERRIDE_KEY) as DevSeasonStatus) ?? 'auto');
    setDateMode(localStorage.getItem(SEASON_DATE_OVERRIDE_KEY) ?? 'auto');
    const saved = localStorage.getItem(MATCHABLE_OVERRIDE_KEY);
    setMatchableCount(saved !== null ? Number(saved) : null);
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  function applyAndReload() {
    if (status === 'auto') {
      localStorage.removeItem(SEASON_OVERRIDE_KEY);
    } else {
      localStorage.setItem(SEASON_OVERRIDE_KEY, status);
    }

    if (dateMode === 'auto') {
      localStorage.removeItem(SEASON_DATE_OVERRIDE_KEY);
    } else if (dateMode === 'dday') {
      localStorage.setItem(SEASON_DATE_OVERRIDE_KEY, getIsoDate(daysLeft));
    } else {
      localStorage.setItem(SEASON_DATE_OVERRIDE_KEY, dateMode);
    }

    if (matchableCount !== null) {
      localStorage.setItem(MATCHABLE_OVERRIDE_KEY, String(matchableCount));
    } else {
      localStorage.removeItem(MATCHABLE_OVERRIDE_KEY);
    }

    if (forceUnassigned) {
      import('@/__fixtures__/mock-db').then(({ mockDb }) => {
        const user = mockDb.getCurrentUser();
        if (user) {
          mockDb.updateUser(user.email, { dormitoryId: UNASSIGNED_ID });
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }

  const showDDaySlider = status === 'SEASON_MATCHING';
  const showDateSelect = status === 'OFF_SEASON';

  return (
    <div className="fixed top-2 right-2 z-50 max-w-sm">
      <motion.div
        initial={false}
        animate={{ width: isOpen ? '320px' : 'auto' }}
        className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold">Home Dev</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-gray-700"
            >
              <div className="p-3 space-y-3">
                {/* Status */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                    시즌 상태
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DevSeasonStatus)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* D-Day Slider */}
                {showDDaySlider && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-400">D-Day</label>
                      <span
                        className={`text-xs font-bold ${
                          daysLeft <= 3
                            ? 'text-red-400'
                            : daysLeft <= 7
                              ? 'text-amber-400'
                              : 'text-cyan-400'
                        }`}
                      >
                        D-{daysLeft}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={daysLeft}
                      onChange={(e) => {
                        setDaysLeft(Number(e.target.value));
                        setDateMode('dday');
                      }}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {DDAY_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            setDaysLeft(preset);
                            setDateMode('dday');
                          }}
                          className={`px-1.5 py-0.5 text-xs rounded ${
                            dateMode === 'dday' && daysLeft === preset
                              ? 'bg-cyan-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date Select — OFF_SEASON */}
                {showDateSelect && (
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                      시즌 날짜
                    </label>
                    <select
                      value={dateMode}
                      onChange={(e) => setDateMode(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {DATE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Matchable Count */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-400">매칭 가능 유저</label>
                    <span className="text-xs font-bold text-cyan-400">
                      {matchableCount !== null ? `${matchableCount}명` : '자동'}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setMatchableCount(null)}
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        matchableCount === null
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      자동
                    </button>
                    {MATCHABLE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMatchableCount(preset)}
                        className={`px-1.5 py-0.5 text-xs rounded ${
                          matchableCount === preset
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Building Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400">건물 미배정</label>
                  <button
                    onClick={() => setForceUnassigned(!forceUnassigned)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      forceUnassigned ? 'bg-cyan-500' : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        forceUnassigned ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Apply */}
                <button
                  onClick={applyAndReload}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  적용 (새로고침)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
