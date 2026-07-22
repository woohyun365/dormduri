'use client';

import { Clock3, Gauge } from 'lucide-react';
import type { MatchingReceivedRequestOrder } from '../../model/matching-request-ordering';

const options = [
  { value: 'expires-soon', label: '만료일순', icon: Clock3 },
  { value: 'match-score', label: '매칭도순', icon: Gauge },
] as const;

export function PairRequestOrderControl({
  value,
  onChange,
}: {
  readonly value: MatchingReceivedRequestOrder;
  readonly onChange: (value: MatchingReceivedRequestOrder) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3" aria-label="받은 요청 정렬">
      <p className="text-xs font-semibold text-(--knu-text-tertiary)">요청 정렬</p>
      <div
        role="group"
        aria-label="받은 요청 정렬 기준"
        className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
      >
        {options.map(({ value: option, label, icon: Icon }) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-1 motion-reduce:transition-none ${
                selected
                  ? 'bg-sky-100 text-sky-800'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => onChange(option)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
