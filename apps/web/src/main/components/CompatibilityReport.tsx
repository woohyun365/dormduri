'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LIFESTYLE_FIELD_NAMES, getLifestyleLabel } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface CompatibilityReportProps {
  userLifestyle: LifestyleData;
  profileLifestyle: LifestyleData;
}

const FIELD_EMOJI: Record<keyof LifestyleData, string> = {
  smoker: '🚬',
  bedtime: '🕐',
  wakeTime: '⏰',
  noiseSensitivity: '🔊',
  cleanliness: '✨',
  sleepHabit: '😴',
  indoorEating: '🍜',
  relationshipStyle: '🤝',
};

const POINTS_PER_FIELD = 12.5;

const BEDTIME_ORDER = ['BEFORE_22', '22_24', '24_02', 'AFTER_02'] as const;
const WAKE_ORDER = ['BEFORE_06', '06_08', '08_10', 'AFTER_10'] as const;
const NOISE_ORDER = ['LOW', 'MID', 'HIGH'] as const;
const CLEAN_ORDER = ['LOW', 'MID', 'HIGH'] as const;

type MatchLevel = 'match' | 'similar' | 'mismatch';

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
  if (mine === null || theirs === null) return 'match';
  if (mine === theirs) return 'match';

  // indoorEating: OK counts as match
  if (field === 'indoorEating' || field === 'smoker') {
    if (mine === 'OK' || theirs === 'OK') return 'match';
  }

  // Ordered fields: distance 1 = similar
  const orderedMap: Partial<Record<keyof LifestyleData, readonly string[]>> = {
    bedtime: BEDTIME_ORDER,
    wakeTime: WAKE_ORDER,
    noiseSensitivity: NOISE_ORDER,
    cleanliness: CLEAN_ORDER,
  };

  const order = orderedMap[field];
  if (order) {
    const dist = indexDistance(order, mine, theirs);
    if (dist === 1) return 'similar';
  }

  return 'mismatch';
}

const MATCH_LEVEL_CONFIG: Record<MatchLevel, { icon: string; color: string; bg: string }> = {
  match: { icon: '✅', color: 'text-green-700', bg: 'bg-green-50' },
  similar: { icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50' },
  mismatch: { icon: '❌', color: 'text-red-700', bg: 'bg-red-50' },
};

const FIELDS = Object.keys(LIFESTYLE_FIELD_NAMES) as (keyof LifestyleData)[];

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
          <span className="text-sm font-bold text-[var(--knu-text-primary)]">호환성 상세</span>
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
                <span className="text-base flex-shrink-0">{FIELD_EMOJI[field]}</span>
                <span className="text-xs font-semibold text-[var(--knu-text-secondary)] w-16 flex-shrink-0">
                  {LIFESTYLE_FIELD_NAMES[field]}
                </span>
                <div className="flex-1 flex items-center gap-2 text-xs">
                  <span className={config.color}>
                    나: {getLifestyleLabel(field, userLifestyle[field])}
                  </span>
                  <span className="text-[var(--knu-text-tertiary)]">|</span>
                  <span className={config.color}>
                    상대: {getLifestyleLabel(field, profileLifestyle[field])}
                  </span>
                </div>
                <span className="text-base flex-shrink-0">{config.icon}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
