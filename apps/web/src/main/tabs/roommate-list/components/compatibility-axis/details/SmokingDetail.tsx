import { BatteryLow, Cigarette, CigaretteOff, Circle, Scale } from 'lucide-react';
import type { ElementType } from 'react';
import { MobileValueCard } from './MobileValueCard';
import type { CompatibilityAxis, CompatibilityBucketTone } from '../types';

type SmokingBehaviorRowId = 'NO' | 'E_CIG' | 'YES';
type SmokingToleranceColumnId = 'NO_ONLY' | 'E_CIG_OK' | 'ANY';

interface SmokingImpactCell {
  readonly tone: CompatibilityBucketTone;
  readonly label: string;
}

interface SmokingImpactStep {
  readonly label: string;
  readonly helper: string;
  readonly trackClassName: string;
  readonly markerClassName: string;
  readonly labelClassName: string;
  readonly markerPosition: string;
}

const SMOKING_BEHAVIOR_ROWS: readonly {
  readonly id: SmokingBehaviorRowId;
  readonly label: string;
}[] = [
  { id: 'NO', label: '비흡연' },
  { id: 'E_CIG', label: '전자담배' },
  { id: 'YES', label: '흡연' },
];

const SMOKING_TOLERANCE_COLUMNS: readonly {
  readonly id: SmokingToleranceColumnId;
  readonly label: string;
}[] = [
  { id: 'NO_ONLY', label: '비흡연만' },
  { id: 'E_CIG_OK', label: '전담 OK' },
  { id: 'ANY', label: '상관없음' },
];

const SMOKING_IMPACT_MATRIX: Record<
  SmokingBehaviorRowId,
  Record<SmokingToleranceColumnId, SmokingImpactCell>
> = {
  NO: {
    NO_ONLY: { tone: 'high', label: '수용 가능' },
    E_CIG_OK: { tone: 'high', label: '수용 가능' },
    ANY: { tone: 'high', label: '수용 가능' },
  },
  E_CIG: {
    NO_ONLY: { tone: 'low', label: '조율 필수' },
    E_CIG_OK: { tone: 'high', label: '수용 가능' },
    ANY: { tone: 'high', label: '수용 가능' },
  },
  YES: {
    NO_ONLY: { tone: 'low', label: '조율 필수' },
    E_CIG_OK: { tone: 'low', label: '조율 필수' },
    ANY: { tone: 'high', label: '수용 가능' },
  },
};

const SMOKING_IMPACT_ORDER = ['high', 'low'] as const;

const SMOKING_IMPACT_STEPS: Record<(typeof SMOKING_IMPACT_ORDER)[number], SmokingImpactStep> = {
  high: {
    label: '수용 가능',
    helper: '나의 허용 기준 안에서 함께 지낼 수 있어요.',
    trackClassName: 'bg-emerald-200',
    markerClassName: 'border-emerald-100 bg-emerald-500 shadow-emerald-100',
    labelClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    markerPosition: '25%',
  },
  low: {
    label: '조율 필수',
    helper: '흡연 기준을 먼저 맞춰보는 게 좋아요.',
    trackClassName: 'bg-slate-200',
    markerClassName: 'border-slate-100 bg-slate-500 shadow-slate-100',
    labelClassName: 'border-slate-200 bg-slate-100 text-slate-700',
    markerPosition: '75%',
  },
};

export function SmokingToleranceImpactCard({
  axis,
}: {
  readonly axis: CompatibilityAxis | undefined;
}) {
  const currentBehavior = inferSmokingBehaviorRow(axis?.comparison.targetText);
  const currentTolerance = inferSmokingToleranceColumn(axis?.comparison.viewerText);
  const activeTolerance = currentTolerance ?? 'NO_ONLY';
  const activeToleranceLabel =
    SMOKING_TOLERANCE_COLUMNS.find((column) => column.id === activeTolerance)?.label ?? '비흡연만';
  const currentBehaviorLabel =
    SMOKING_BEHAVIOR_ROWS.find((row) => row.id === currentBehavior)?.label ?? '상대 흡연';
  const currentCell = currentBehavior
    ? SMOKING_IMPACT_MATRIX[currentBehavior][activeTolerance]
    : undefined;
  const currentStep =
    currentCell?.tone === 'high' ? SMOKING_IMPACT_STEPS.high : SMOKING_IMPACT_STEPS.low;
  const currentSmokingVisual = getSmokingValueIcon(currentBehavior);
  const activeToleranceVisual = getSmokingToleranceIcon(activeTolerance);

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="흡연 기준 비교"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100"
            aria-hidden="true"
          >
            <Scale className="h-3.5 w-3.5 text-slate-700" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900">흡연 기준 비교</p>
            <p className="mt-1 text-[11px] leading-4 text-(--knu-text-secondary)">
              나의 허용 기준에 따라 달라요.
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-3 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-2.5 sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(13rem,0.85fr)] sm:items-center sm:gap-3"
        aria-label="나의 흡연 허용 기준과 상대 흡연 여부 조합"
      >
        <div className="rounded-2xl border border-white/80 bg-white/75 p-2 shadow-sm sm:hidden">
          <MobileValueCard
            label="나의 기준"
            value={activeToleranceLabel}
            Icon={activeToleranceVisual.Icon}
            iconClassName={activeToleranceVisual.iconClassName}
            iconWrapperClassName={activeToleranceVisual.iconWrapperClassName}
            ariaLabel={`나의 흡연 허용 기준: ${activeToleranceLabel}`}
          />
          <MobileValueCard
            className="mt-2"
            label="상대 흡연"
            value={currentBehaviorLabel}
            Icon={currentSmokingVisual.Icon}
            iconClassName={currentSmokingVisual.iconClassName}
            iconWrapperClassName={currentSmokingVisual.iconWrapperClassName}
            ariaLabel={`현재 조합: ${activeToleranceLabel} 기준과 ${currentBehaviorLabel}`}
          />
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white/75 shadow-sm sm:block">
          <table
            className="w-full table-fixed border-collapse"
            aria-label="나의 흡연 허용 기준과 상대 흡연 여부 조합표"
          >
            <caption className="sr-only">나의 흡연 허용 기준과 상대 흡연 여부를 보여줘요.</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-19 border-r border-b border-slate-200 bg-slate-50 px-1.5 py-2 text-left text-[10px] font-extrabold leading-4 text-slate-500 sm:w-20 sm:px-2"
                >
                  나의 기준
                </th>
                {SMOKING_TOLERANCE_COLUMNS.map((column) => {
                  const selected = column.id === activeTolerance;

                  return (
                    <th
                      key={column.id}
                      scope="col"
                      className={`border-r border-b border-slate-200 bg-slate-50 px-1.5 py-2 text-center text-[10px] font-extrabold leading-4 last:border-r-0 sm:px-2 ${
                        selected ? 'text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {column.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th
                  scope="row"
                  className="border-r border-slate-200 bg-slate-50 px-1.5 py-3 text-left text-[10px] font-extrabold leading-4 text-slate-600 sm:px-2"
                >
                  상대 흡연
                </th>
                {SMOKING_TOLERANCE_COLUMNS.map((column) => {
                  const selected = column.id === activeTolerance;

                  return (
                    <td
                      key={column.id}
                      className="h-12 border-r border-slate-200 bg-white/70 px-1 py-1.5 last:border-r-0"
                    >
                      <div className="flex h-full items-center justify-center">
                        {selected ? (
                          <SmokingValueChip
                            label={currentBehaviorLabel}
                            behavior={currentBehavior}
                            ariaLabel={`현재 조합: ${column.label} 기준과 ${currentBehaviorLabel}`}
                          />
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 sm:mt-0">
          <div className="relative" aria-label="현재 흡연 조합 체감 막대">
            <div
              className="grid grid-cols-2 overflow-hidden rounded-full border border-white bg-white shadow-inner"
              aria-hidden="true"
            >
              {SMOKING_IMPACT_ORDER.map((tone) => {
                const step = SMOKING_IMPACT_STEPS[tone];

                return <span key={tone} className={`h-2.5 ${step.trackClassName}`} />;
              })}
            </div>
            {currentCell ? (
              <span
                className="absolute -top-1.5 h-5 w-5 rounded-full border-4 border-white"
                style={{ left: `calc(${currentStep.markerPosition} - 0.625rem)` }}
                aria-hidden="true"
              >
                <span
                  className={`block h-full w-full rounded-full shadow-lg ${currentStep.markerClassName}`}
                />
              </span>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1" aria-label="흡연 체감 단계">
            {SMOKING_IMPACT_ORDER.map((tone) => {
              const step = SMOKING_IMPACT_STEPS[tone];
              const selected = currentCell?.tone === tone;

              return (
                <div
                  key={tone}
                  className={`rounded-xl border px-2 py-1.5 text-center text-[10px] font-extrabold leading-4 ${
                    selected ? step.labelClassName : 'border-white bg-white/80 text-slate-500'
                  }`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmokingValueChip({
  label,
  behavior,
  ariaLabel,
}: {
  readonly label: string;
  readonly behavior: SmokingBehaviorRowId | undefined;
  readonly ariaLabel: string;
}) {
  const { Icon, iconClassName, iconWrapperClassName } = getSmokingValueIcon(behavior);

  return (
    <span
      className="inline-flex max-w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm"
      aria-label={ariaLabel}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${iconWrapperClassName}`}
        aria-hidden="true"
      >
        <Icon className={`h-2.5 w-2.5 shrink-0 ${iconClassName}`} />
      </span>
      <span className="min-w-0 break-keep text-center text-[10px] leading-4 font-extrabold whitespace-normal text-(--knu-text-primary) sm:text-[11px]">
        {label}
      </span>
    </span>
  );
}

function getSmokingValueIcon(behavior: SmokingBehaviorRowId | undefined): {
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName: string;
  readonly iconWrapperClassName: string;
} {
  if (behavior === 'E_CIG') {
    return {
      Icon: BatteryLow,
      iconClassName: 'text-rose-300',
      iconWrapperClassName: 'bg-rose-50',
    };
  }

  if (behavior === 'YES') {
    return {
      Icon: Cigarette,
      iconClassName: 'text-rose-500',
      iconWrapperClassName: 'bg-rose-50',
    };
  }

  return {
    Icon: CigaretteOff,
    iconClassName: 'text-slate-500',
    iconWrapperClassName: 'bg-slate-100',
  };
}

function getSmokingToleranceIcon(tolerance: SmokingToleranceColumnId): {
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName: string;
  readonly iconWrapperClassName: string;
} {
  if (tolerance === 'E_CIG_OK') {
    return {
      Icon: BatteryLow,
      iconClassName: 'text-rose-300',
      iconWrapperClassName: 'bg-rose-50',
    };
  }

  if (tolerance === 'ANY') {
    return {
      Icon: Circle,
      iconClassName: 'text-slate-500',
      iconWrapperClassName: 'bg-slate-100',
    };
  }

  return {
    Icon: CigaretteOff,
    iconClassName: 'text-slate-500',
    iconWrapperClassName: 'bg-slate-100',
  };
}

function inferSmokingBehaviorRow(value: string | undefined): SmokingBehaviorRowId | undefined {
  if (!value) return undefined;
  if (value.includes('전자') || value.includes('전담')) return 'E_CIG';
  if (value.includes('비흡연')) return 'NO';
  if (value.includes('흡연')) return 'YES';
  return undefined;
}

function inferSmokingToleranceColumn(
  value: string | undefined,
): SmokingToleranceColumnId | undefined {
  if (!value) return undefined;
  if (value.includes('전담') || value.includes('전자')) return 'E_CIG_OK';
  if (value.includes('상관') || value.includes('괜찮')) return 'ANY';
  if (value.includes('비흡연')) return 'NO_ONLY';
  return undefined;
}
