import { Thermometer } from 'lucide-react';
import type { CompatibilityAxis } from '../types';

type TemperatureSensitivityKind = 'cold' | 'normal' | 'hot' | 'unknown';

const TEMPERATURE_SCALE_OPTIONS: readonly {
  readonly id: Exclude<TemperatureSensitivityKind, 'unknown'>;
  readonly label: string;
  readonly className: string;
}[] = [
  { id: 'cold', label: '추위 탐', className: 'text-sky-700' },
  { id: 'normal', label: '보통', className: 'text-slate-600' },
  { id: 'hot', label: '더위 탐', className: 'text-rose-700' },
];

export function TemperatureSensitivityComparisonCard({
  axis,
}: {
  readonly axis: CompatibilityAxis | undefined;
}) {
  const targetKind = inferTemperatureSensitivity(axis?.comparison.targetText);
  const viewerKind = inferTemperatureSensitivity(axis?.comparison.viewerText);
  const targetLabel = getTemperatureSensitivityLabel(targetKind);
  const viewerLabel = getTemperatureSensitivityLabel(viewerKind);
  const markersOverlap = targetKind === viewerKind;

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="온도 조절 비교"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-50"
          aria-hidden="true"
        >
          <Thermometer className="h-3.5 w-3.5 text-sky-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">에어컨·난방 민감도</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            추위·더위 민감도를 한 줄로 비교해요.
          </p>
          <ul
            className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-extrabold leading-4"
            aria-label="온도 조절 marker 색상 안내"
          >
            <li className="inline-flex items-center gap-1 text-indigo-700">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />나
            </li>
            <li className="inline-flex items-center gap-1 text-sky-700">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden="true" />
              상대
            </li>
          </ul>
        </div>
      </div>

      <div
        className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-4"
        aria-label="추위 보통 더위 온도 조절 막대"
      >
        <div className="relative px-2 pb-6 pt-2">
          <div className="relative h-5 rounded-full bg-linear-to-r from-sky-300 via-slate-100 to-rose-300 shadow-inner">
            <TemperatureSensitivityMarker
              kind={viewerKind}
              label="나"
              valueLabel={viewerLabel}
              className="bg-indigo-500"
              overlapSide={markersOverlap ? 'left' : 'center'}
            />
            <TemperatureSensitivityMarker
              kind={targetKind}
              label="상대"
              valueLabel={targetLabel}
              className="bg-sky-500"
              overlapSide={markersOverlap ? 'right' : 'center'}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-0.5 text-[10px] font-extrabold leading-4">
            {TEMPERATURE_SCALE_OPTIONS.map((option) => (
              <span key={option.id} className={option.className}>
                {option.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemperatureSensitivityMarker({
  kind,
  label,
  valueLabel,
  className,
  overlapSide,
}: {
  readonly kind: TemperatureSensitivityKind;
  readonly label: string;
  readonly valueLabel: string;
  readonly className: string;
  readonly overlapSide: 'left' | 'center' | 'right';
}) {
  return (
    <span
      className={`absolute top-1/2 h-4 w-4 rounded-full border-2 border-white shadow-md ${className}`}
      style={{
        left: getTemperatureSensitivityLeft(kind),
        transform: getTemperatureSensitivityMarkerTransform(overlapSide),
      }}
      aria-label={`${label}: ${valueLabel}`}
    >
      <span className="sr-only">{`${label}: ${valueLabel}`}</span>
    </span>
  );
}

function getTemperatureSensitivityMarkerTransform(overlapSide: 'left' | 'center' | 'right') {
  if (overlapSide === 'left') return 'translate(-85%, -50%)';
  if (overlapSide === 'right') return 'translate(-15%, -50%)';
  return 'translate(-50%, -50%)';
}

function inferTemperatureSensitivity(value: string | undefined): TemperatureSensitivityKind {
  if (!value) return 'unknown';
  if (value.includes('추위') || value.includes('춥')) return 'cold';
  if (value.includes('더위') || value.includes('덥')) return 'hot';
  if (value.includes('보통')) return 'normal';
  return 'unknown';
}

function getTemperatureSensitivityLeft(kind: TemperatureSensitivityKind): string {
  if (kind === 'cold') return '0.75rem';
  if (kind === 'hot') return 'calc(100% - 0.75rem)';
  return '50%';
}

function getTemperatureSensitivityLabel(kind: TemperatureSensitivityKind): string {
  if (kind === 'cold') return '추위 탐';
  if (kind === 'hot') return '더위 탐';
  if (kind === 'normal') return '보통';
  return '확인 필요';
}
