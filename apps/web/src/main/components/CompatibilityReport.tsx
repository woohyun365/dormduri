'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  formatLifestyleFieldName,
  formatLifestyleOptionLabel,
  BEDTIME_ORDER,
  WAKE_TIME_ORDER,
  TEMPERATURE_SENSITIVITY_ORDER,
} from '@/main/tabs/profile/model/lifestyleFormFields';
import type { LifestyleData } from '@repo/shared/lifestyle';

interface CompatibilityReportProps {
  userLifestyle: LifestyleData;
  profileLifestyle: LifestyleData;
}

// 음주 필드(drinkingFrequency, drinkingTolerance)는 정책(AC-N8)에 따라 표시 제외
const DISPLAY_FIELDS: (keyof LifestyleData)[] = [
  'smokingBehavior',
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanLevel',
  'sleepHabit',
  'indoorEating',
  'relationshipStyle',
  'sleepEnvironment',
  'phoneBehavior',
  'earphoneUsage',
  'temperatureSensitivity',
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'cleanExpectation',
];

const FIELD_EMOJI: Partial<Record<keyof LifestyleData, string>> = {
  smokingBehavior: '🚬',
  bedtime: '🕐',
  wakeTime: '⏰',
  noiseSensitivity: '🔊',
  cleanLevel: '✨',
  sleepHabit: '😴',
  indoorEating: '🍜',
  relationshipStyle: '🤝',
  sleepEnvironment: '🌙',
  phoneBehavior: '📱',
  earphoneUsage: '🎧',
  temperatureSensitivity: '🌡️',
  smokingTolerance: '🚭',
  phoneTolerance: '📞',
  earphoneExpectation: '🎵',
  sleepEnvPreference: '🔇',
  cleanExpectation: '🧹',
};

type MatchLevel = 'match' | 'similar' | 'mismatch' | 'unknown';

function indexDistance(order: readonly string[], a: string, b: string): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return -1;
  return Math.abs(ia - ib);
}

function getFieldMatchLevel(
  field: keyof LifestyleData,
  mine: string | null,
  theirs: string | null,
): MatchLevel {
  if (mine === null || theirs === null) return 'unknown';
  if (mine === theirs) return 'match';

  // Ordered fields: distance 1 = similar
  const orderedMap: Partial<Record<keyof LifestyleData, readonly string[]>> = {
    bedtime: BEDTIME_ORDER,
    wakeTime: WAKE_TIME_ORDER,
    temperatureSensitivity: TEMPERATURE_SENSITIVITY_ORDER,
  };

  const order = orderedMap[field];
  if (order) {
    const dist = indexDistance(order, mine, theirs);
    if (dist === 1) return 'similar';
  }

  return 'mismatch';
}

const MATCH_LEVEL_CONFIG: Record<MatchLevel, { color: string; bg: string }> = {
  match: { color: 'text-green-700', bg: 'bg-green-50' },
  similar: { color: 'text-amber-700', bg: 'bg-amber-50' },
  mismatch: { color: 'text-red-700', bg: 'bg-red-50' },
  unknown: { color: 'text-gray-500', bg: 'bg-gray-50' },
};

const FIELDS = DISPLAY_FIELDS;

export function CompatibilityReport({ userLifestyle, profileLifestyle }: CompatibilityReportProps) {
  const [expanded, setExpanded] = useState(false);

  const matchCount = FIELDS.filter(
    (field) => getFieldMatchLevel(field, userLifestyle[field], profileLifestyle[field]) === 'match',
  ).length;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-4"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[(--knu-text-primary)]">호환성 상세</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
            {matchCount}/{FIELDS.length} 일치
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-blue-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {FIELDS.map((field) => {
            const level = getFieldMatchLevel(field, userLifestyle[field], profileLifestyle[field]);
            const config = MATCH_LEVEL_CONFIG[level];

            return (
              <div
                key={field}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${config.bg}`}
              >
                <span className="text-base shrink-0">{FIELD_EMOJI[field] ?? '•'}</span>
                <span className="text-xs font-semibold text-[(--knu-text-secondary)] w-16 shrink-0">
                  {formatLifestyleFieldName(field)}
                </span>
                <div className="flex-1 flex items-center gap-2 text-xs">
                  <span className={config.color}>
                    나: {formatLifestyleOptionLabel(field, userLifestyle[field])}
                  </span>
                  <span className="text-[(--knu-text-tertiary)]">|</span>
                  <span className={config.color}>
                    상대: {formatLifestyleOptionLabel(field, profileLifestyle[field])}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
