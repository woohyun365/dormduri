import { Bed, Info, Moon } from 'lucide-react';
import type { ElementType } from 'react';
import { IconBubbleText, IconDentalBroken, IconEar, IconZzz } from '@tabler/icons-react';
import { MobileValueCard } from './MobileValueCard';
import type { CompatibilityAxis, CompatibilityBucketTone } from '../types';

type SleepHabitHeatmapRowId = 'NONE' | 'TALKING' | 'SNORING' | 'GRINDING';
type NoiseSensitivityHeatmapColumnId = 'SENSITIVE' | 'NORMAL' | 'DEEP';

interface SleepHabitHeatmapCell {
  readonly tone: CompatibilityBucketTone;
  readonly label: string;
  readonly helper: string;
}

interface SleepHabitSensoryImpactStep {
  readonly label: string;
  readonly helper: string;
  readonly trackClassName: string;
  readonly markerClassName: string;
  readonly labelClassName: string;
  readonly markerPosition: string;
}

interface SleepHabitValueVisual {
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName: string;
  readonly iconWrapperClassName: string;
}

const SLEEP_HABIT_HEATMAP_ROWS: readonly {
  readonly id: SleepHabitHeatmapRowId;
  readonly label: string;
}[] = [
  { id: 'NONE', label: '없음' },
  { id: 'TALKING', label: '잠꼬대' },
  { id: 'GRINDING', label: '이갈이' },
  { id: 'SNORING', label: '코골이' },
];

const SLEEP_HABIT_VALUE_VISUAL: Record<SleepHabitHeatmapRowId, SleepHabitValueVisual> = {
  NONE: {
    Icon: Moon,
    iconClassName: 'text-indigo-900',
    iconWrapperClassName: 'bg-indigo-50',
  },
  TALKING: {
    Icon: IconBubbleText,
    iconClassName: 'text-[#7CA1B5]',
    iconWrapperClassName: 'bg-[#EFF6F9]',
  },
  GRINDING: {
    Icon: IconDentalBroken,
    iconClassName: 'text-[#DFB2CC]',
    iconWrapperClassName: 'bg-[#FBF1F6]',
  },
  SNORING: {
    Icon: IconZzz,
    iconClassName: 'text-[#C9C5DE]',
    iconWrapperClassName: 'bg-[#F3F1FA]',
  },
};

const NOISE_SENSITIVITY_HEATMAP_COLUMNS: readonly {
  readonly id: NoiseSensitivityHeatmapColumnId;
  readonly label: string;
}[] = [
  { id: 'SENSITIVE', label: '민감함' },
  { id: 'NORMAL', label: '보통' },
  { id: 'DEEP', label: '둔함' },
];

const SLEEP_HABIT_NOISE_HEATMAP: Record<
  SleepHabitHeatmapRowId,
  Record<NoiseSensitivityHeatmapColumnId, SleepHabitHeatmapCell>
> = {
  NONE: {
    SENSITIVE: { tone: 'high', label: '잘 맞음', helper: '잠을 방해할 요소가 적어요.' },
    NORMAL: { tone: 'high', label: '잘 맞음', helper: '잠을 방해할 요소가 적어요.' },
    DEEP: { tone: 'high', label: '잘 맞음', helper: '잠을 방해할 요소가 적어요.' },
  },
  TALKING: {
    SENSITIVE: { tone: 'low', label: '서로 다름', helper: '작은 소리도 거슬릴 수 있어요.' },
    NORMAL: { tone: 'high', label: '잘 맞음', helper: '대체로 무리 없이 지낼 수 있어요.' },
    DEEP: { tone: 'high', label: '잘 맞음', helper: '대체로 무리 없이 지낼 수 있어요.' },
  },
  SNORING: {
    SENSITIVE: { tone: 'low', label: '서로 다름', helper: '잠들기 전 기준을 꼭 맞춰보세요.' },
    NORMAL: { tone: 'low', label: '서로 다름', helper: '잠들기 전 기준을 꼭 맞춰보세요.' },
    DEEP: { tone: 'medium', label: '조율 가능', helper: '상황에 따라 조율이 필요해요.' },
  },
  GRINDING: {
    SENSITIVE: { tone: 'low', label: '서로 다름', helper: '작은 소리도 거슬릴 수 있어요.' },
    NORMAL: { tone: 'medium', label: '조율 가능', helper: '상황에 따라 조율이 필요해요.' },
    DEEP: { tone: 'high', label: '잘 맞음', helper: '대체로 무리 없이 지낼 수 있어요.' },
  },
};

const SLEEP_HABIT_SENSORY_IMPACT_ORDER = ['high', 'medium', 'low'] as const;

const SLEEP_HABIT_SLOT_FRAME_CLASS = 'border-slate-100 bg-slate-50/70';

const SLEEP_HABIT_SENSORY_IMPACT_STEPS: Record<
  CompatibilityBucketTone,
  SleepHabitSensoryImpactStep
> = {
  high: {
    label: '편안함',
    helper: '크게 신경 쓰이지 않을 가능성이 높아요.',
    trackClassName: 'bg-emerald-200',
    markerClassName: 'border-emerald-100 bg-emerald-500 shadow-emerald-100',
    labelClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    markerPosition: '16.666%',
  },
  medium: {
    label: '수용 가능',
    helper: '생활 기준을 맞추면 함께 지내기 괜찮을 수 있어요.',
    trackClassName: 'bg-blue-200',
    markerClassName: 'border-blue-100 bg-blue-500 shadow-blue-100',
    labelClassName: 'border-blue-100 bg-blue-50 text-blue-700',
    markerPosition: '50%',
  },
  low: {
    label: '조율 필수',
    helper: '잠들기 전 기준을 더 구체적으로 맞춰보는 게 좋아요.',
    trackClassName: 'bg-slate-200',
    markerClassName: 'border-slate-100 bg-slate-500 shadow-slate-100',
    labelClassName: 'border-slate-200 bg-slate-100 text-slate-700',
    markerPosition: '83.333%',
  },
  unknown: {
    label: '확인 필요',
    helper: '상대 잠버릇을 더 확인해 보면 좋아요.',
    trackClassName: 'bg-slate-200',
    markerClassName: 'border-slate-100 bg-slate-500 shadow-slate-100',
    labelClassName: 'border-slate-100 bg-slate-50 text-slate-600',
    markerPosition: '50%',
  },
};

export function SleepHabitSensitivityImpactCard({
  axis,
}: {
  readonly axis: CompatibilityAxis | undefined;
}) {
  const currentSleepHabit = inferSleepHabitHeatmapRow(axis?.comparison.targetText);
  const currentNoiseSensitivity = inferNoiseSensitivityHeatmapColumn(axis?.comparison.viewerText);
  const activeNoiseSensitivity = currentNoiseSensitivity ?? 'NORMAL';
  const activeNoiseLabel =
    NOISE_SENSITIVITY_HEATMAP_COLUMNS.find((column) => column.id === activeNoiseSensitivity)
      ?.label ?? '보통';
  const currentSleepHabitLabel =
    SLEEP_HABIT_HEATMAP_ROWS.find((row) => row.id === currentSleepHabit)?.label ?? '상대 잠버릇';
  const currentCell = currentSleepHabit
    ? SLEEP_HABIT_NOISE_HEATMAP[currentSleepHabit][activeNoiseSensitivity]
    : undefined;
  const currentStep = SLEEP_HABIT_SENSORY_IMPACT_STEPS[currentCell?.tone ?? 'unknown'];
  const currentSleepHabitVisual = currentSleepHabit
    ? SLEEP_HABIT_VALUE_VISUAL[currentSleepHabit]
    : undefined;
  const sleepHabitDetailIconTone = SLEEP_HABIT_VALUE_VISUAL.TALKING;

  return (
    <div
      className="mt-3 rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm"
      aria-label="잠버릇 예상 체감"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-50"
            aria-hidden="true"
          >
            <IconEar className="h-3.5 w-3.5 text-indigo-500" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900">잠버릇 예상 체감</p>
            <p className="mt-1 text-[11px] leading-4 text-(--knu-text-secondary)">
              나의 잠귀에 따라 달라요.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`mt-3 rounded-2xl border-2 p-2.5 sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(13rem,0.85fr)] sm:items-center sm:gap-3 ${SLEEP_HABIT_SLOT_FRAME_CLASS}`}
        aria-label="나의 잠귀와 상대 잠버릇 조합"
      >
        <div className="rounded-2xl border border-white/80 bg-white/75 p-2 shadow-sm sm:hidden">
          <MobileValueCard
            label="나의 잠귀"
            value={activeNoiseLabel}
            Icon={IconEar}
            iconClassName="text-indigo-500"
            iconWrapperClassName="bg-indigo-50"
            ariaLabel={`나의 잠귀: ${activeNoiseLabel}`}
          />

          <MobileValueCard
            className="mt-2"
            label="상대 잠버릇"
            value={currentSleepHabitLabel}
            Icon={currentSleepHabitVisual?.Icon ?? Bed}
            iconClassName={sleepHabitDetailIconTone.iconClassName}
            iconWrapperClassName={sleepHabitDetailIconTone.iconWrapperClassName}
            ariaLabel={`현재 조합: ${activeNoiseLabel} 민감도와 ${currentSleepHabitLabel}`}
          />

          <p className="mt-2 text-[10px] font-semibold leading-4 text-(--knu-text-tertiary)">
            잠버릇: 코골이·이갈이·잠꼬대 기준
          </p>
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white/75 shadow-sm sm:block">
          <table
            className="w-full table-fixed border-collapse"
            aria-label="나의 잠귀와 상대 잠버릇 조합표"
          >
            <caption className="sr-only">
              나의 잠귀 민감도와 상대 잠버릇의 현재 조합을 보여줘요.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-19 border-r border-b border-slate-200 bg-slate-50 px-1.5 py-2 text-left text-[10px] font-extrabold leading-4 text-slate-500 sm:w-20 sm:px-2"
                >
                  나의 잠귀
                </th>
                {NOISE_SENSITIVITY_HEATMAP_COLUMNS.map((column) => {
                  const selected = column.id === activeNoiseSensitivity;

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
                  상대 잠버릇
                </th>
                {NOISE_SENSITIVITY_HEATMAP_COLUMNS.map((column) => {
                  const selected = column.id === activeNoiseSensitivity;

                  return (
                    <td
                      key={column.id}
                      className="h-20 border-r border-slate-200 bg-white/70 px-1 py-2 last:border-r-0"
                    >
                      <div className="flex h-full items-center justify-center">
                        {selected ? (
                          <SleepHabitValueChip
                            sleepHabit={currentSleepHabit}
                            label={currentSleepHabitLabel}
                            size="compact"
                            ariaLabel={`현재 조합: ${column.label} 민감도와 ${currentSleepHabitLabel}`}
                          />
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
          <p className="border-t border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold leading-4 text-(--knu-text-tertiary)">
            잠버릇: 코골이·이갈이·잠꼬대 기준
          </p>
        </div>

        <div className="mt-3 sm:mt-0">
          <div className="relative" aria-label="현재 조합 체감 막대">
            <div
              className="grid grid-cols-3 overflow-hidden rounded-full border border-white bg-white shadow-inner"
              aria-hidden="true"
            >
              {SLEEP_HABIT_SENSORY_IMPACT_ORDER.map((tone) => {
                const step = SLEEP_HABIT_SENSORY_IMPACT_STEPS[tone];

                return <span key={tone} className={`h-2.5 ${step.trackClassName}`} />;
              })}
            </div>
            {currentCell ? (
              <span
                className="absolute -top-1.5 h-5 w-5 rounded-full border-4 border-white"
                style={{
                  left: `calc(${currentStep.markerPosition} - 0.625rem)`,
                }}
                aria-hidden="true"
              >
                <span
                  className={`block h-full w-full rounded-full shadow-lg ${currentStep.markerClassName}`}
                />
              </span>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1" aria-label="체감 단계">
            {SLEEP_HABIT_SENSORY_IMPACT_ORDER.map((tone) => {
              const step = SLEEP_HABIT_SENSORY_IMPACT_STEPS[tone];
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

          <div className="mt-2 flex items-start gap-1.5 text-[10px] font-semibold leading-4 text-(--knu-text-secondary)">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            <p>
              <span className="block">잠버릇의 심한 정도는 구분하지 않아요.</span>
              <span className="block">대화로 확인해보세요.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SleepHabitValueChip({
  sleepHabit,
  label,
  size,
  ariaLabel,
}: {
  readonly sleepHabit: SleepHabitHeatmapRowId | undefined;
  readonly label: string;
  readonly size: 'compact' | 'comfortable';
  readonly ariaLabel?: string;
}) {
  const visual = sleepHabit ? SLEEP_HABIT_VALUE_VISUAL[sleepHabit] : undefined;
  const detailIconTone = SLEEP_HABIT_VALUE_VISUAL.TALKING;
  const Icon = visual?.Icon ?? Bed;
  const iconSizeClassName = size === 'compact' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';
  const wrapperSizeClassName = size === 'compact' ? 'h-4 w-4' : 'h-6 w-6';
  const textSizeClassName = size === 'compact' ? 'text-[10px] sm:text-[11px]' : 'text-sm';
  const paddingClassName = size === 'compact' ? 'px-2 py-2' : 'px-2.5 py-2';
  const gapClassName = size === 'compact' ? 'gap-1' : 'gap-1.5';

  return (
    <span
      className={`inline-flex max-w-full items-center justify-center ${gapClassName} rounded-xl border border-slate-200 bg-white shadow-sm ${paddingClassName}`}
      aria-label={ariaLabel}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${wrapperSizeClassName} ${
          visual?.iconWrapperClassName ?? 'bg-slate-100'
        }`}
        aria-hidden="true"
      >
        <Icon className={`shrink-0 ${iconSizeClassName} ${detailIconTone.iconClassName}`} />
      </span>
      <span
        className={`min-w-0 break-keep text-center leading-4 font-extrabold whitespace-normal text-(--knu-text-primary) ${textSizeClassName}`}
      >
        {label}
      </span>
    </span>
  );
}

function inferSleepHabitHeatmapRow(value: string | undefined): SleepHabitHeatmapRowId | undefined {
  if (!value) return undefined;
  if (value.includes('코골')) return 'SNORING';
  if (value.includes('잠꼬대')) return 'TALKING';
  if (value.includes('이갈')) return 'GRINDING';
  if (value.includes('없')) return 'NONE';
  return undefined;
}

function inferNoiseSensitivityHeatmapColumn(
  value: string | undefined,
): NoiseSensitivityHeatmapColumnId | undefined {
  if (!value) return undefined;
  if (value.includes('둔')) return 'DEEP';
  if (value.includes('보통')) return 'NORMAL';
  if (value.includes('민감') || value.includes('밝')) return 'SENSITIVE';
  return undefined;
}
