'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { SeasonState } from '@/types/season';
import { mockDb } from '@/__fixtures__/mock-db';
import {
  MATCH_SENT_OVERRIDE_KEY,
  MATCH_RECEIVED_OVERRIDE_KEY,
  MATCH_CHATS_OVERRIDE_KEY,
  readOptionalNumber,
  writeOptionalNumber,
} from '@/main/utils/homeDevOverrides';

const SEASON_OVERRIDE_KEY = 'devpanel-season-override';
const SEASON_DATE_OVERRIDE_KEY = 'devpanel-season-date-override';

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

type PastSeasonSelection = 'none' | 'failed' | 'matched';

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function getIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function getInitialSeasonStatus(): DevSeasonStatus {
  if (!isDevelopment()) return 'auto';
  return (readStoredValue(SEASON_OVERRIDE_KEY) as DevSeasonStatus) ?? 'auto';
}

function getInitialDateMode(): string {
  if (!isDevelopment()) return 'auto';
  return readStoredValue(SEASON_DATE_OVERRIDE_KEY) ?? 'auto';
}

function getInitialDaysLeft(): number {
  if (!isDevelopment()) return 14;
  const stored = readStoredValue(SEASON_DATE_OVERRIDE_KEY);
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
    const target = new Date(`${stored}T00:00:00+09:00`).getTime();
    const now = Date.now();
    const days = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 14;
  }
  return 14;
}

function getInitialPastSeason(): PastSeasonSelection {
  if (!isDevelopment()) return 'none';
  return mockDb.getHomeDashboardState().pastSeason;
}

function getInitialNextSeasonRegistered(): boolean {
  if (!isDevelopment()) return false;
  return mockDb.getHomeDashboardState().nextSeasonRegistered;
}

export function HomeDevTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<DevSeasonStatus>(getInitialSeasonStatus);
  const [dateMode, setDateMode] = useState<string>(getInitialDateMode);
  const [daysLeft, setDaysLeft] = useState(getInitialDaysLeft);
  const [sentCount, setSentCount] = useState<number | null>(() =>
    readOptionalNumber(MATCH_SENT_OVERRIDE_KEY),
  );
  const [receivedCount, setReceivedCount] = useState<number | null>(() =>
    readOptionalNumber(MATCH_RECEIVED_OVERRIDE_KEY),
  );
  const [chatsCount, setChatsCount] = useState<number | null>(() =>
    readOptionalNumber(MATCH_CHATS_OVERRIDE_KEY),
  );
  const [pastSeason, setPastSeason] = useState<PastSeasonSelection>(getInitialPastSeason);
  const [nextSeasonRegistered, setNextSeasonRegistered] = useState(getInitialNextSeasonRegistered);

  if (!isDevelopment()) return null;

  function applyAndReload() {
    if (status === 'auto') localStorage.removeItem(SEASON_OVERRIDE_KEY);
    else localStorage.setItem(SEASON_OVERRIDE_KEY, status);

    if (dateMode === 'auto') localStorage.removeItem(SEASON_DATE_OVERRIDE_KEY);
    else if (dateMode === 'dday')
      localStorage.setItem(SEASON_DATE_OVERRIDE_KEY, getIsoDate(daysLeft));
    else localStorage.setItem(SEASON_DATE_OVERRIDE_KEY, dateMode);

    writeOptionalNumber(MATCH_SENT_OVERRIDE_KEY, sentCount);
    writeOptionalNumber(MATCH_RECEIVED_OVERRIDE_KEY, receivedCount);
    writeOptionalNumber(MATCH_CHATS_OVERRIDE_KEY, chatsCount);

    mockDb.setHomeDashboardState({
      pastSeason,
      nextSeasonRegistered,
    });

    window.location.reload();
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
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                    시즌 상태
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as DevSeasonStatus)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

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
                      onChange={(event) => {
                        setDaysLeft(Number(event.target.value));
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

                {showDateSelect && (
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                      시즌 날짜
                    </label>
                    <select
                      value={dateMode}
                      onChange={(event) => setDateMode(event.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {DATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                    매칭 통계
                  </label>
                  <div className="space-y-2">
                    <CountRow
                      label="보낸 요청"
                      value={sentCount}
                      onChange={setSentCount}
                      max={3}
                      color="text-amber-400"
                    />
                    <CountRow
                      label="받은 요청"
                      value={receivedCount}
                      onChange={setReceivedCount}
                      max={10}
                      color="text-purple-400"
                    />
                    <CountRow
                      label="대화 중"
                      value={chatsCount}
                      onChange={setChatsCount}
                      max={5}
                      color="text-teal-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                    과거 시즌
                  </label>
                  <div className="flex gap-1 flex-wrap">
                    <PresetButton
                      active={pastSeason === 'none'}
                      onClick={() => setPastSeason('none')}
                      label="미참여"
                    />
                    <PresetButton
                      active={pastSeason === 'failed'}
                      onClick={() => setPastSeason('failed')}
                      label="미성사"
                    />
                    <PresetButton
                      active={pastSeason === 'matched'}
                      onClick={() => setPastSeason('matched')}
                      label="매칭 성공"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400">다음 시즌 등록</label>
                  <button
                    onClick={() => setNextSeasonRegistered(!nextSeasonRegistered)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      nextSeasonRegistered ? 'bg-cyan-500' : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        nextSeasonRegistered ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

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

function PresetButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 text-xs rounded ${active ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
    >
      {label}
    </button>
  );
}

function CountRow({
  label,
  value,
  onChange,
  max,
  color,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16">{label}</span>
      <span className={`text-xs font-bold w-8 text-right ${color}`}>{value ?? '-'}</span>
      <div className="flex gap-0.5 flex-1">
        <PresetButton active={value === null} onClick={() => onChange(null)} label="자동" />
        {Array.from({ length: max + 1 }, (_, index) => (
          <PresetButton
            key={index}
            active={value === index}
            onClick={() => onChange(index)}
            label={String(index)}
          />
        ))}
      </div>
    </div>
  );
}
