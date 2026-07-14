import {
  AlarmClock,
  BatteryLow,
  Bed,
  ChevronDown,
  Cigarette,
  CigaretteOff,
  Circle,
  Headphones,
  Info,
  ListChecks,
  MonitorSmartphone,
  Moon,
  Phone,
  PhoneCall,
  PhoneOff,
  Scale,
  Sparkles,
  Thermometer,
  Utensils,
  Volume2,
  Users,
} from 'lucide-react';
import { IconBubbleText, IconDentalBroken, IconEar, IconZzz } from '@tabler/icons-react';
import type { ElementType, ReactNode } from 'react';
import type { CompatibilityChartViewModel } from '../model/compatibility/compatibilityChart.mapper';
import type { PublicProfileCompatibilityAxisId } from '@repo/shared/profile/contract';

interface CompatibilityAxisListProps {
  readonly viewModel: CompatibilityChartViewModel;
}

type CompatibilityDimension = CompatibilityChartViewModel['dimensions'][number];
type CompatibilityAxis = CompatibilityChartViewModel['axes'][number];
type CompatibilityBucketTone = CompatibilityDimension['bucketTone'];

interface CompactDetailTheme {
  readonly container: string;
  readonly list: string;
  readonly empty: string;
  readonly title: string;
}

const TONE_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-slate-100 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};

const TONE_BORDER_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-blue-100 bg-blue-50 text-blue-700',
  low: 'border-slate-200 bg-slate-100 text-slate-700',
  unknown: 'border-slate-200 bg-slate-100 text-slate-600',
};

const BAR_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
  unknown: 'bg-slate-300',
};

const RANGE_FRAME_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'border-emerald-200 bg-emerald-50/30',
  medium: 'border-blue-200 bg-blue-50/30',
  low: 'border-slate-300 bg-slate-50/70',
  unknown: 'border-slate-200 bg-slate-50/50',
};

const RANGE_TEXT_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'text-emerald-700',
  medium: 'text-blue-700',
  low: 'text-slate-700',
  unknown: 'text-slate-600',
};

interface AxisVisualConfig {
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName: string;
  readonly iconWrapperClassName: string;
}

const AXIS_VISUAL_CONFIG: Record<PublicProfileCompatibilityAxisId, AxisVisualConfig> = {
  SMOKING: {
    Icon: Cigarette,
    iconClassName: 'text-rose-500',
    iconWrapperClassName: 'bg-rose-50',
  },
  SLEEP_HABIT: {
    Icon: IconEar,
    iconClassName: 'text-indigo-500',
    iconWrapperClassName: 'bg-indigo-50',
  },
  PHONE: {
    Icon: Phone,
    iconClassName: 'text-blue-500',
    iconWrapperClassName: 'bg-blue-50',
  },
  EARPHONE: {
    Icon: Headphones,
    iconClassName: 'text-indigo-500',
    iconWrapperClassName: 'bg-indigo-50',
  },
  SLEEP_ENVIRONMENT: {
    Icon: Moon,
    iconClassName: 'text-sky-500',
    iconWrapperClassName: 'bg-sky-50',
  },
  SCREEN_USAGE: {
    Icon: MonitorSmartphone,
    iconClassName: 'text-violet-500',
    iconWrapperClassName: 'bg-violet-50',
  },
  CLEAN_LEVEL: {
    Icon: Sparkles,
    iconClassName: 'text-emerald-500',
    iconWrapperClassName: 'bg-emerald-50',
  },
  INDOOR_EATING: {
    Icon: Utensils,
    iconClassName: 'text-orange-500',
    iconWrapperClassName: 'bg-orange-50',
  },
  BEDTIME: {
    Icon: Moon,
    iconClassName: 'text-amber-500',
    iconWrapperClassName: 'bg-amber-50',
  },
  WAKE_TIME: {
    Icon: AlarmClock,
    iconClassName: 'text-cyan-500',
    iconWrapperClassName: 'bg-cyan-50',
  },
  TEMPERATURE: {
    Icon: Thermometer,
    iconClassName: 'text-red-500',
    iconWrapperClassName: 'bg-red-50',
  },
  RELATIONSHIP: {
    Icon: Users,
    iconClassName: 'text-orange-500',
    iconWrapperClassName: 'bg-orange-50',
  },
};

export function CompatibilityAxisList({ viewModel }: CompatibilityAxisListProps) {
  const axesById = new Map(viewModel.axes.map((axis) => [axis.id, axis]));

  return (
    <section
      aria-labelledby="roommate-compatibility-axis-heading"
      className="rounded-3xl border border-sky-100 bg-sky-50/50 p-4"
    >
      <div className="flex items-start gap-2">
        <ListChecks className="mt-0.5 h-4 w-4 text-sky-500" aria-hidden />
        <div>
          <h3
            id="roommate-compatibility-axis-heading"
            className="text-sm font-bold text-(--knu-text-primary)"
          >
            축별 적합도
          </h3>
          <p className="mt-1 text-xs leading-5 text-(--knu-text-secondary)">
            {viewModel.privacyNote}
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2" aria-label="축별 적합도 목록">
        {viewModel.dimensions.map((dimension) => {
          const childAxes = dimension.axisIds
            .map((axisId) => axesById.get(axisId))
            .filter((axis): axis is CompatibilityAxis => Boolean(axis));

          return (
            <li
              key={dimension.id}
              className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--knu-text-primary)">
                    {dimension.label}
                  </p>
                  <p className="mt-1 break-keep text-xs leading-5 whitespace-normal text-(--knu-text-secondary)">
                    {dimension.description}
                  </p>
                  <p className="mt-1 text-xs font-bold text-(--knu-text-tertiary)">매칭도</p>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                    TONE_CLASS[dimension.bucketTone]
                  }`}
                >
                  {dimension.bucketLabel}
                </span>
              </div>
              <DimensionAxisComparisonCards dimension={dimension} axes={childAxes} />
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full ${BAR_CLASS[dimension.bucketTone]}`}
                  style={{ width: `${dimension.score ?? 0}%` }}
                />
              </div>
              <DimensionAxisDetails dimension={dimension} axes={childAxes} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DimensionAxisComparisonCards({
  dimension,
  axes,
}: {
  readonly dimension: CompatibilityDimension;
  readonly axes: readonly CompatibilityAxis[];
}) {
  if (axes.length === 0) return null;

  const theme = getCompactDetailTheme(dimension.id);
  if (!theme) return null;

  const displayAxes = getCompactDisplayAxes(dimension.id, axes);
  const singleAxis = displayAxes.length === 1;

  return (
    <div className={`mt-3 rounded-2xl border p-3 ${theme.list}`}>
      <ul
        className={`grid gap-2 ${singleAxis ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}
        aria-label={getCompactDetailListLabel(dimension)}
      >
        {displayAxes.map((axis) => (
          <CompactAxisDetailCard
            key={axis.id}
            axis={axis}
            displayLabel={getCompactAxisDisplayLabel(dimension.id, axis)}
            titleClassName={theme.title}
            className={getCompactAxisCardClassName(dimension.id, axis.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function DimensionAxisDetails({
  dimension,
  axes,
}: {
  readonly dimension: CompatibilityDimension;
  readonly axes: readonly CompatibilityAxis[];
}) {
  const compactDetailTheme = getCompactDetailTheme(dimension.id);
  const isCompactDetail = Boolean(compactDetailTheme);

  return (
    <details
      className={`group mt-3 overflow-hidden rounded-2xl border ${
        compactDetailTheme?.container ?? 'border-slate-100 bg-slate-50/70'
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden">
        <span className="min-w-0 break-keep text-xs leading-4 font-bold whitespace-normal text-(--knu-text-secondary)">
          {getDimensionDetailSummaryLabel(dimension)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] font-bold text-(--knu-text-tertiary)">
          {axes.length}개 항목
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>

      {axes.length > 0 && isCompactDetail && compactDetailTheme ? (
        <CompactDimensionDetailPanel axes={axes} dimension={dimension} theme={compactDetailTheme} />
      ) : (
        <p
          className={`border-t px-3 py-3 text-xs leading-5 text-(--knu-text-secondary) ${
            compactDetailTheme?.empty ?? 'border-slate-100 bg-white/80'
          }`}
        >
          이 축의 시각화가 아직 준비되지 않았어요.
        </p>
      )}
    </details>
  );
}

function getDimensionDetailSummaryLabel(dimension: CompatibilityDimension): string {
  const labels: Record<CompatibilityDimension['id'], string> = {
    SMOKING: '흡연 자세히 보기',
    SLEEP_RHYTHM: '수면 리듬 자세히 보기',
    SLEEP_HABIT: '잠버릇 자세히 보기',
    SLEEP_ENVIRONMENT: '수면 환경 자세히 보기',
    DEVICE_USAGE: '통화·미디어 자세히 보기',
    CLEAN_SPACE: '청소 루틴 자세히 보기',
    TEMPERATURE: '온도 조절 자세히 보기',
    RELATIONSHIP_STYLE: '친밀도 자세히 보기',
  };

  return labels[dimension.id];
}

function getCompactDetailTheme(
  _dimensionId: CompatibilityDimension['id'],
): CompactDetailTheme | undefined {
  return {
    container: 'border-sky-100 bg-sky-50/70',
    list: 'border-sky-100 bg-sky-50/50',
    empty: 'border-sky-100 bg-white/80',
    title: 'text-sky-700',
  };
}

function CompactDimensionDetailPanel({
  axes,
  dimension,
  theme,
}: {
  readonly axes: readonly CompatibilityAxis[];
  readonly dimension: CompatibilityDimension;
  readonly theme: CompactDetailTheme;
}) {
  return (
    <div className={`border-t p-3 ${theme.list}`}>
      {dimension.id === 'SMOKING' ? (
        <SmokingToleranceImpactCard axis={axes.find((axis) => axis.id === 'SMOKING')} />
      ) : null}
      {dimension.id === 'SLEEP_RHYTHM' ? <SleepRhythmTimeSlotComparison axes={axes} /> : null}
      {dimension.id === 'SLEEP_HABIT' ? (
        <SleepHabitSensitivityImpactCard axis={axes.find((axis) => axis.id === 'SLEEP_HABIT')} />
      ) : null}
      {dimension.id === 'SLEEP_ENVIRONMENT' ? (
        <SleepEnvironmentCoordinationCard axes={axes} />
      ) : null}
      {dimension.id === 'DEVICE_USAGE' ? <DeviceUsageCoordinationCard axes={axes} /> : null}
      {dimension.id === 'CLEAN_SPACE' ? <CleanSpaceCoordinationCard axes={axes} /> : null}
      {dimension.id === 'TEMPERATURE' ? (
        <TemperatureSensitivityComparisonCard
          axis={axes.find((axis) => axis.id === 'TEMPERATURE')}
        />
      ) : null}
      {dimension.id === 'RELATIONSHIP_STYLE' ? (
        <RelationshipDistanceComparisonCard
          axis={axes.find((axis) => axis.id === 'RELATIONSHIP')}
        />
      ) : null}
    </div>
  );
}

const DIMENSION_AXIS_DISPLAY_ORDER: Partial<
  Record<CompatibilityDimension['id'], readonly PublicProfileCompatibilityAxisId[]>
> = {
  SLEEP_RHYTHM: ['BEDTIME', 'WAKE_TIME'],
  SLEEP_ENVIRONMENT: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
  DEVICE_USAGE: ['PHONE', 'EARPHONE'],
  CLEAN_SPACE: ['CLEAN_LEVEL', 'INDOOR_EATING'],
} as const;

function getCompactDisplayAxes(
  dimensionId: CompatibilityDimension['id'],
  axes: readonly CompatibilityAxis[],
): readonly CompatibilityAxis[] {
  const configuredOrder = DIMENSION_AXIS_DISPLAY_ORDER[dimensionId];
  if (!configuredOrder) return axes;

  const order = new Map<PublicProfileCompatibilityAxisId, number>(
    configuredOrder.map((axisId, index) => [axisId, index]),
  );
  return [...axes].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

function getCompactDetailListLabel(dimension: CompatibilityDimension): string {
  if (dimension.id === 'RELATIONSHIP_STYLE') {
    return '기숙사 생활 방식 점수 구성 항목';
  }

  return `${dimension.label} 점수 구성 항목`;
}

function CompactAxisDetailCard({
  axis,
  displayLabel,
  titleClassName,
  className,
}: {
  readonly axis: CompatibilityAxis;
  readonly displayLabel: string;
  readonly titleClassName: string;
  readonly className?: string;
}) {
  const config = AXIS_VISUAL_CONFIG[axis.id];
  const Icon = config.Icon;
  const comparisonLabel = getCompactComparisonLabel(axis.id);

  return (
    <li
      className={`rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm backdrop-blur ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${config.iconWrapperClassName}`}
            aria-hidden="true"
          >
            <Icon className={`h-3.5 w-3.5 ${config.iconClassName}`} />
          </span>
          <p className={`min-w-0 break-keep text-xs leading-4 font-bold ${titleClassName}`}>
            {displayLabel}
          </p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            TONE_BORDER_CLASS[axis.bucketTone]
          }`}
        >
          {axis.bucketLabel}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs leading-5">
        <p className="flex items-center justify-between gap-2">
          <span className="text-(--knu-text-tertiary)">{comparisonLabel.target}</span>
          <ComparisonValue value={axis.comparison.targetText} />
        </p>
        <p className="flex items-center justify-between gap-2">
          <span className="text-(--knu-text-tertiary)">{comparisonLabel.viewer}</span>
          <ComparisonValue value={axis.comparison.viewerText} />
        </p>
      </div>

      {axis.neutralNotice ? (
        <p className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50 px-2.5 py-2 text-[11px] font-semibold leading-5 text-cyan-700">
          {axis.neutralNotice}
        </p>
      ) : null}
    </li>
  );
}

function ComparisonValue({ value }: { readonly value: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-[68%] items-center justify-end text-right font-bold text-(--knu-text-primary)">
      <span className="min-w-0 break-keep whitespace-normal">{value}</span>
    </span>
  );
}

function getCompactAxisCardClassName(
  _dimensionId: CompatibilityDimension['id'],
  _axisId: PublicProfileCompatibilityAxisId,
): string | undefined {
  return undefined;
}

function getCompactAxisDisplayLabel(
  dimensionId: CompatibilityDimension['id'],
  axis: CompatibilityAxis,
): string {
  if (dimensionId === 'RELATIONSHIP_STYLE' && axis.id === 'RELATIONSHIP') {
    return '기숙사 생활 방식';
  }

  return axis.label;
}

function getCompactComparisonLabel(axisId: PublicProfileCompatibilityAxisId): {
  readonly target: string;
  readonly viewer: string;
} {
  if (axisId === 'SMOKING') {
    return { target: '상대방', viewer: '나의 선호' };
  }

  if (axisId === 'SLEEP_HABIT') {
    return { target: '상대방', viewer: '나의 잠귀' };
  }

  if (
    axisId === 'SLEEP_ENVIRONMENT' ||
    axisId === 'SCREEN_USAGE' ||
    axisId === 'PHONE' ||
    axisId === 'EARPHONE'
  ) {
    return { target: '상대방', viewer: '나의 기준' };
  }

  return { target: '상대', viewer: '나' };
}

type SmokingBehaviorRowId = 'NO' | 'E_CIG' | 'YES';
type SmokingToleranceColumnId = 'NO_ONLY' | 'E_CIG_OK' | 'ANY';

interface SmokingImpactCell {
  readonly tone: CompatibilityBucketTone;
  readonly label: string;
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

const SMOKING_IMPACT_STEPS: Pick<
  Record<CompatibilityBucketTone, SleepHabitSensoryImpactStep>,
  'high' | 'low'
> = {
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

function SmokingToleranceImpactCard({ axis }: { readonly axis: CompatibilityAxis | undefined }) {
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
          <SleepHabitMobileValueCard
            label="나의 기준"
            value={activeToleranceLabel}
            Icon={activeToleranceVisual.Icon}
            iconClassName={activeToleranceVisual.iconClassName}
            iconWrapperClassName={activeToleranceVisual.iconWrapperClassName}
            ariaLabel={`나의 흡연 허용 기준: ${activeToleranceLabel}`}
          />
          <SleepHabitMobileValueCard
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

function SleepHabitSensitivityImpactCard({
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
          <SleepHabitMobileValueCard
            label="나의 잠귀"
            value={activeNoiseLabel}
            Icon={IconEar}
            iconClassName="text-indigo-500"
            iconWrapperClassName="bg-indigo-50"
            ariaLabel={`나의 잠귀: ${activeNoiseLabel}`}
          />

          <SleepHabitMobileValueCard
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

type DeviceUsageValueKind =
  | 'rarelyCall'
  | 'sometimesCall'
  | 'oftenCall'
  | 'outsideCallOnly'
  | 'briefCallOk'
  | 'anyCall'
  | 'alwaysEarphone'
  | 'mostlyEarphone'
  | 'mostlySpeaker'
  | 'alwaysSpeaker'
  | 'mustEarphone'
  | 'lowVolumeOk'
  | 'anySound'
  | 'unknown';

type DeviceUsageSupportLevel = 'match' | 'partial' | 'outside';

interface DeviceUsageCoordinationChannel {
  readonly id: 'phone' | 'earphone';
  readonly axis: CompatibilityAxis | undefined;
  readonly targetKind: DeviceUsageValueKind;
  readonly viewerKind: DeviceUsageValueKind;
}

interface DeviceUsageLaneOption {
  readonly id: DeviceUsageValueKind;
  readonly label: string;
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const PHONE_USAGE_LANE_OPTIONS: readonly DeviceUsageLaneOption[] = [
  { id: 'rarelyCall', label: '잘 안 해요', Icon: PhoneOff },
  { id: 'sometimesCall', label: '가끔 해요', Icon: Phone },
  { id: 'oftenCall', label: '자주 해요', Icon: PhoneCall },
];

const EARPHONE_USAGE_LANE_OPTIONS: readonly DeviceUsageLaneOption[] = [
  { id: 'alwaysEarphone', label: '항상 이어폰', Icon: Headphones },
  { id: 'mostlyEarphone', label: '주로 이어폰', Icon: Headphones },
  { id: 'mostlySpeaker', label: '주로 스피커', Icon: Volume2 },
  { id: 'alwaysSpeaker', label: '항상 스피커', Icon: Volume2 },
];

function DeviceUsageCoordinationCard({ axes }: { readonly axes: readonly CompatibilityAxis[] }) {
  const phoneAxis = axes.find((axis) => axis.id === 'PHONE');
  const earphoneAxis = axes.find((axis) => axis.id === 'EARPHONE');
  const channels = [
    {
      id: 'phone',
      axis: phoneAxis,
      targetKind: inferPhoneTarget(phoneAxis?.comparison.targetText),
      viewerKind: inferPhonePreference(phoneAxis?.comparison.viewerText),
    },
    {
      id: 'earphone',
      axis: earphoneAxis,
      targetKind: inferEarphoneTarget(earphoneAxis?.comparison.targetText),
      viewerKind: inferEarphonePreference(earphoneAxis?.comparison.viewerText),
    },
  ] as const satisfies readonly [DeviceUsageCoordinationChannel, DeviceUsageCoordinationChannel];

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="통화·미디어 사용 조율 정보"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-50"
          aria-hidden="true"
        >
          <Headphones className="h-3.5 w-3.5 text-sky-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">상대의 통화·이어폰 사용 습관</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            실내 통화와 소리 습관을 확인해요.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="상대방 통화·미디어 사용 2-lane">
        <DeviceUsageLaneCard
          title="실내 통화"
          targetUsageLabel="상대의 실내 통화 습관"
          rangeTone={channels[0].axis?.bucketTone ?? 'unknown'}
          targetKind={channels[0].targetKind}
          viewerLabel={getPhonePreferenceLabel(channels[0].viewerKind)}
          supportByKind={getPhoneSupportByKind(channels[0].viewerKind)}
          options={PHONE_USAGE_LANE_OPTIONS}
        />
        <DeviceUsageLaneCard
          title="영상 시청 시 소리"
          targetUsageLabel="상대의 이어폰 습관"
          rangeTone={channels[1].axis?.bucketTone ?? 'unknown'}
          targetKind={channels[1].targetKind}
          viewerLabel={getEarphonePreferenceLabel(channels[1].viewerKind)}
          supportByKind={getEarphoneSupportByKind(channels[1].viewerKind)}
          options={EARPHONE_USAGE_LANE_OPTIONS}
        />
      </div>
    </div>
  );
}

function DeviceUsageLaneCard({
  title,
  targetUsageLabel,
  rangeTone,
  targetKind,
  viewerLabel,
  supportByKind: supportConfig,
  options,
}: {
  readonly title: string;
  readonly targetUsageLabel: string;
  readonly rangeTone: CompatibilityBucketTone;
  readonly targetKind: DeviceUsageValueKind;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<DeviceUsageValueKind, DeviceUsageSupportLevel>>;
  readonly options: readonly DeviceUsageLaneOption[];
}) {
  const supportByKind = Object.fromEntries(
    options.map((option) => [option.id, supportConfig[option.id] ?? 'outside']),
  ) as Record<DeviceUsageValueKind, DeviceUsageSupportLevel>;
  const acceptedOptions = options.filter((option) => supportByKind[option.id] !== 'outside');
  const outsideOptions = options.filter((option) => supportByKind[option.id] === 'outside');

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm"
      aria-label={`${title} 2-lane`}
    >
      <p className="text-[11px] font-extrabold leading-4 text-slate-900">{title}</p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className={`text-[10px] font-extrabold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}>
            나의 조건 범위
          </p>
          <p
            className={`text-right text-[10px] font-bold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}
          >
            {viewerLabel}
          </p>
        </div>
        <ul className="grid gap-1.5" aria-label={`${title} 상대방 상태`}>
          {acceptedOptions.length > 0 ? (
            <li
              className={`rounded-2xl border-2 p-1.5 ${RANGE_FRAME_CLASS[rangeTone]}`}
              aria-label={`${title} 나의 조건 범위`}
            >
              <p className="mb-1 px-1 text-[10px] font-extrabold leading-4 text-slate-600">
                {targetUsageLabel}
              </p>
              <ul className="grid gap-1.5">
                {acceptedOptions.map((option) => (
                  <DeviceUsageLaneOptionItem
                    key={option.id}
                    option={option}
                    active={option.id === targetKind}
                    supportLevel={supportByKind[option.id]}
                  />
                ))}
              </ul>
            </li>
          ) : null}
          {outsideOptions.map((option) => (
            <DeviceUsageLaneOptionItem
              key={option.id}
              option={option}
              active={option.id === targetKind}
              supportLevel={supportByKind[option.id]}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeviceUsageLaneOptionItem({
  option,
  active,
  supportLevel,
}: {
  readonly option: DeviceUsageLaneOption;
  readonly active: boolean;
  readonly supportLevel: DeviceUsageSupportLevel;
}) {
  const Icon = option.Icon;
  const inRange = supportLevel !== 'outside';
  const itemClassName = active
    ? 'border-sky-300 bg-sky-50/90 text-sky-900 shadow-sm ring-1 ring-sky-200'
    : inRange
      ? 'border-indigo-100 bg-white/85 text-slate-700'
      : 'border-slate-100 bg-slate-50/70 text-slate-500';
  const iconClassName = active
    ? 'bg-white text-sky-700 ring-1 ring-sky-100'
    : 'bg-white/80 text-slate-400';

  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 ${itemClassName}`}
      aria-current={active ? 'true' : undefined}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-keep text-[11px] leading-4 font-extrabold whitespace-normal">
        {option.label}
      </span>
      {active ? (
        <span className="ml-auto hidden shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 min-[361px]:inline-flex">
          상대
        </span>
      ) : null}
    </li>
  );
}

function getPhoneSupportByKind(
  kind: DeviceUsageValueKind,
): Partial<Record<DeviceUsageValueKind, DeviceUsageSupportLevel>> {
  if (kind === 'anyCall') {
    return { rarelyCall: 'match', sometimesCall: 'match', oftenCall: 'partial' };
  }
  if (kind === 'briefCallOk') {
    return { rarelyCall: 'match', sometimesCall: 'match' };
  }
  if (kind === 'outsideCallOnly') {
    return { rarelyCall: 'match' };
  }
  return {};
}

function getEarphoneSupportByKind(
  kind: DeviceUsageValueKind,
): Partial<Record<DeviceUsageValueKind, DeviceUsageSupportLevel>> {
  if (kind === 'anySound') {
    return {
      alwaysEarphone: 'match',
      mostlyEarphone: 'match',
      mostlySpeaker: 'match',
      alwaysSpeaker: 'match',
    };
  }
  if (kind === 'lowVolumeOk') {
    return {
      alwaysEarphone: 'match',
      mostlyEarphone: 'match',
      mostlySpeaker: 'partial',
    };
  }
  if (kind === 'mustEarphone') {
    return { alwaysEarphone: 'match', mostlyEarphone: 'partial' };
  }
  return {};
}

function getPhonePreferenceLabel(kind: DeviceUsageValueKind): string {
  if (kind === 'anyCall') return '상관없음';
  if (kind === 'briefCallOk') return '짧게는 OK';
  if (kind === 'outsideCallOnly') return '통화는 밖에서';
  return '통화 기준 확인 필요';
}

function getEarphonePreferenceLabel(kind: DeviceUsageValueKind): string {
  if (kind === 'anySound') return '상관없음';
  if (kind === 'lowVolumeOk') return '작은 소리 OK';
  if (kind === 'mustEarphone') return '소리는 이어폰으로';
  return '이어폰 기준 확인 필요';
}

function inferPhoneTarget(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('자주')) return 'oftenCall';
  if (value.includes('가끔')) return 'sometimesCall';
  if (value.includes('잘 안') || value.includes('거의')) return 'rarelyCall';
  return 'unknown';
}

function inferPhonePreference(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('상관')) return 'anyCall';
  if (value.includes('가끔') || value.includes('짧게')) return 'briefCallOk';
  if (value.includes('안 했') || value.includes('밖')) return 'outsideCallOnly';
  return 'unknown';
}

function inferEarphoneTarget(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('항상 스피커')) return 'alwaysSpeaker';
  if (value.includes('주로 스피커')) return 'mostlySpeaker';
  if (value.includes('주로 이어폰')) return 'mostlyEarphone';
  if (value.includes('항상 이어폰')) return 'alwaysEarphone';
  return 'unknown';
}

function inferEarphonePreference(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('상관')) return 'anySound';
  if (value.includes('작게') || value.includes('작은 소리')) return 'lowVolumeOk';
  if (
    value.includes('이어폰으로') ||
    value.includes('들어줬') ||
    value.includes('꼭') ||
    value.includes('써줬')
  ) {
    return 'mustEarphone';
  }
  return 'unknown';
}

type CleanSpaceValueKind =
  | 'cleanImmediately'
  | 'cleanVisible'
  | 'cleanWhenDirty'
  | 'strictClean'
  | 'basicClean'
  | 'flexibleClean'
  | 'rarelyEat'
  | 'snackEat'
  | 'mealEat'
  | 'noSmell'
  | 'cleanOk'
  | 'anyEating'
  | 'unknown';

type CleanSpaceSupportLevel = 'match' | 'partial' | 'outside';

interface CleanSpaceCoordinationChannel {
  readonly id: 'clean' | 'eating';
  readonly title: string;
  readonly targetUsageLabel: string;
  readonly axis: CompatibilityAxis | undefined;
  readonly targetKind: CleanSpaceValueKind;
  readonly viewerKind: CleanSpaceValueKind;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<CleanSpaceValueKind, CleanSpaceSupportLevel>>;
  readonly options: readonly CleanSpaceLaneOption[];
  readonly note: string | null;
}

interface CleanSpaceLaneOption {
  readonly id: CleanSpaceValueKind;
  readonly label: string;
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const CLEAN_LEVEL_LANE_OPTIONS: readonly CleanSpaceLaneOption[] = [
  { id: 'cleanImmediately', label: '바로 정리', Icon: Sparkles },
  { id: 'cleanVisible', label: '눈에 띄면 정리', Icon: Sparkles },
  { id: 'cleanWhenDirty', label: '몰아서 정리', Icon: Sparkles },
];

const INDOOR_EATING_LANE_OPTIONS: readonly CleanSpaceLaneOption[] = [
  { id: 'rarelyEat', label: '잘 안 먹어요', Icon: Utensils },
  { id: 'snackEat', label: '간식은 먹어요', Icon: Utensils },
  { id: 'mealEat', label: '배달·간편식', Icon: Utensils },
];

function CleanSpaceCoordinationCard({ axes }: { readonly axes: readonly CompatibilityAxis[] }) {
  const cleanAxis = axes.find((axis) => axis.id === 'CLEAN_LEVEL');
  const eatingAxis = axes.find((axis) => axis.id === 'INDOOR_EATING');
  const channels = [
    {
      id: 'clean',
      title: '청소 빈도',
      targetUsageLabel: '상대의 청소 루틴',
      axis: cleanAxis,
      targetKind: inferCleanLevelTarget(cleanAxis?.comparison.targetText),
      viewerKind: inferCleanExpectation(cleanAxis?.comparison.viewerText),
      viewerLabel: getCleanExpectationLabel(
        inferCleanExpectation(cleanAxis?.comparison.viewerText),
      ),
      supportByKind: getCleanSupportByKind(inferCleanExpectation(cleanAxis?.comparison.viewerText)),
      options: CLEAN_LEVEL_LANE_OPTIONS,
      note: null,
    },
    {
      id: 'eating',
      title: '실내 취식',
      targetUsageLabel: '상대의 실내 취식 습관',
      axis: eatingAxis,
      targetKind: inferIndoorEatingTarget(eatingAxis?.comparison.targetText),
      viewerKind: inferIndoorEatingTolerance(eatingAxis?.comparison.viewerText),
      viewerLabel: getIndoorEatingToleranceLabel(
        inferIndoorEatingTolerance(eatingAxis?.comparison.viewerText),
      ),
      supportByKind: getIndoorEatingSupportByKind(
        inferIndoorEatingTolerance(eatingAxis?.comparison.viewerText),
      ),
      options: INDOOR_EATING_LANE_OPTIONS,
      note: '실내 취식은 냄새가 기준이에요.',
    },
  ] as const satisfies readonly [CleanSpaceCoordinationChannel, CleanSpaceCoordinationChannel];

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="청소 루틴 조율 정보"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-50"
          aria-hidden="true"
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">상대의 청소·취식 습관</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            청소 빈도·실내 취식 습관을 조율해요.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="상대방 청소 루틴 2-lane">
        {channels.map((channel) => (
          <CleanSpaceLaneCard
            key={channel.id}
            title={channel.title}
            targetUsageLabel={channel.targetUsageLabel}
            rangeTone={channel.axis?.bucketTone ?? 'unknown'}
            targetKind={channel.targetKind}
            viewerLabel={channel.viewerLabel}
            supportByKind={channel.supportByKind}
            options={channel.options}
            note={channel.note}
          />
        ))}
      </div>
    </div>
  );
}

function CleanSpaceLaneCard({
  title,
  targetUsageLabel,
  rangeTone,
  targetKind,
  viewerLabel,
  supportByKind: supportConfig,
  options,
  note,
}: {
  readonly title: string;
  readonly targetUsageLabel: string;
  readonly rangeTone: CompatibilityBucketTone;
  readonly targetKind: CleanSpaceValueKind;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<CleanSpaceValueKind, CleanSpaceSupportLevel>>;
  readonly options: readonly CleanSpaceLaneOption[];
  readonly note: string | null;
}) {
  const supportByKind = Object.fromEntries(
    options.map((option) => [option.id, supportConfig[option.id] ?? 'outside']),
  ) as Record<CleanSpaceValueKind, CleanSpaceSupportLevel>;
  const acceptedOptions = options.filter((option) => supportByKind[option.id] !== 'outside');
  const outsideOptions = options.filter((option) => supportByKind[option.id] === 'outside');

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm"
      aria-label={`${title} 2-lane`}
    >
      <p className="text-[11px] font-extrabold leading-4 text-slate-900">{title}</p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className={`text-[10px] font-extrabold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}>
            나의 조건 범위
          </p>
          <p
            className={`text-right text-[10px] font-bold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}
          >
            {viewerLabel}
          </p>
        </div>
        <ul className="grid gap-1.5" aria-label={`${title} 상대방 상태`}>
          {acceptedOptions.length > 0 ? (
            <li
              className={`rounded-2xl border-2 p-1.5 ${RANGE_FRAME_CLASS[rangeTone]}`}
              aria-label={`${title} 나의 조건 범위`}
            >
              <p className="mb-1 px-1 text-[10px] font-extrabold leading-4 text-slate-600">
                {targetUsageLabel}
              </p>
              <ul className="grid gap-1.5">
                {acceptedOptions.map((option) => (
                  <CleanSpaceLaneOptionItem
                    key={option.id}
                    option={option}
                    active={option.id === targetKind}
                    supportLevel={supportByKind[option.id]}
                  />
                ))}
              </ul>
            </li>
          ) : null}
          {outsideOptions.map((option) => (
            <CleanSpaceLaneOptionItem
              key={option.id}
              option={option}
              active={option.id === targetKind}
              supportLevel={supportByKind[option.id]}
            />
          ))}
        </ul>
      </div>

      {note ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-2xl border border-sky-100 bg-sky-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-sky-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </div>
      ) : null}
    </div>
  );
}

function CleanSpaceLaneOptionItem({
  option,
  active,
  supportLevel,
}: {
  readonly option: CleanSpaceLaneOption;
  readonly active: boolean;
  readonly supportLevel: CleanSpaceSupportLevel;
}) {
  const Icon = option.Icon;
  const inRange = supportLevel !== 'outside';
  const itemClassName = active
    ? 'border-sky-300 bg-sky-50/90 text-sky-900 shadow-sm ring-1 ring-sky-200'
    : inRange
      ? 'border-indigo-100 bg-white/85 text-slate-700'
      : 'border-slate-100 bg-slate-50/70 text-slate-500';
  const iconClassName = active
    ? 'bg-white text-sky-700 ring-1 ring-sky-100'
    : 'bg-white/80 text-slate-400';

  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 ${itemClassName}`}
      aria-current={active ? 'true' : undefined}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-keep text-[11px] leading-4 font-extrabold whitespace-normal">
        {option.label}
      </span>
      {active ? (
        <span className="ml-auto hidden shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 min-[361px]:inline-flex">
          상대
        </span>
      ) : null}
    </li>
  );
}

function getCleanSupportByKind(
  kind: CleanSpaceValueKind,
): Partial<Record<CleanSpaceValueKind, CleanSpaceSupportLevel>> {
  if (kind === 'flexibleClean') {
    return {
      cleanImmediately: 'match',
      cleanVisible: 'match',
      cleanWhenDirty: 'match',
    };
  }
  if (kind === 'basicClean') {
    return { cleanImmediately: 'match', cleanVisible: 'match' };
  }
  if (kind === 'strictClean') {
    return { cleanImmediately: 'match' };
  }
  return {};
}

function getIndoorEatingSupportByKind(
  kind: CleanSpaceValueKind,
): Partial<Record<CleanSpaceValueKind, CleanSpaceSupportLevel>> {
  if (kind === 'anyEating') {
    return { rarelyEat: 'match', snackEat: 'match', mealEat: 'match' };
  }
  if (kind === 'cleanOk') {
    return { rarelyEat: 'match', snackEat: 'match', mealEat: 'partial' };
  }
  if (kind === 'noSmell') {
    return { rarelyEat: 'match', snackEat: 'match' };
  }
  return {};
}

function getCleanExpectationLabel(kind: CleanSpaceValueKind): string {
  if (kind === 'flexibleClean') return '몰아서도 OK';
  if (kind === 'basicClean') return '눈에 띄면 OK';
  if (kind === 'strictClean') return '바로 정리 선호';
  return '청소 기준 확인 필요';
}

function getIndoorEatingToleranceLabel(kind: CleanSpaceValueKind): string {
  if (kind === 'anyEating') return '상관없음';
  if (kind === 'cleanOk') return '환기·정리하면 OK';
  if (kind === 'noSmell') return '냄새는 피하고 싶어요';
  return '취식 기준 확인 필요';
}

function inferCleanLevelTarget(value: string | undefined): CleanSpaceValueKind {
  if (!value) return 'unknown';
  if (value.includes('바로') || value.includes('주 3')) return 'cleanImmediately';
  if (value.includes('눈에')) return 'cleanVisible';
  if (value.includes('몰아서') || value.includes('더러')) return 'cleanWhenDirty';
  return 'unknown';
}

function inferCleanExpectation(value: string | undefined): CleanSpaceValueKind {
  if (!value) return 'unknown';
  if (value.includes('몰아서') || value.includes('유연')) return 'flexibleClean';
  if (value.includes('눈에')) return 'basicClean';
  if (value.includes('바로') || value.includes('엄격')) return 'strictClean';
  return 'unknown';
}

function inferIndoorEatingTarget(value: string | undefined): CleanSpaceValueKind {
  if (!value) return 'unknown';
  if (value.includes('배달') || value.includes('간편식') || value.includes('식사')) {
    return 'mealEat';
  }
  if (value.includes('간식')) return 'snackEat';
  if (value.includes('잘 안') || value.includes('거의')) return 'rarelyEat';
  return 'unknown';
}

function inferIndoorEatingTolerance(value: string | undefined): CleanSpaceValueKind {
  if (!value) return 'unknown';
  if (value.includes('상관')) return 'anyEating';
  if (value.includes('환기') || value.includes('정리') || value.includes('OK')) return 'cleanOk';
  if (value.includes('안 먹') || value.includes('냄새')) return 'noSmell';
  return 'unknown';
}

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

function TemperatureSensitivityComparisonCard({
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

type RelationshipDistanceKind = 'casual' | 'close' | 'unknown';

const RELATIONSHIP_DISTANCE_OPTIONS: readonly {
  readonly id: Exclude<RelationshipDistanceKind, 'unknown'>;
  readonly label: string;
  readonly labelClassName: string;
}[] = [
  {
    id: 'casual',
    label: '각자 생활해요',
    labelClassName: 'text-slate-700',
  },
  {
    id: 'close',
    label: '친하게 지내요',
    labelClassName: 'text-orange-700',
  },
];

function RelationshipDistanceComparisonCard({
  axis,
}: {
  readonly axis: CompatibilityAxis | undefined;
}) {
  const targetKind = inferRelationshipDistance(axis?.comparison.targetText);
  const viewerKind = inferRelationshipDistance(axis?.comparison.viewerText);
  const targetLabel = getRelationshipDistanceLabel(targetKind);
  const viewerLabel = getRelationshipDistanceLabel(viewerKind);
  const markersOverlap = targetKind === viewerKind;
  const matchedKind = getMatchedRelationshipDistanceKind(viewerKind, targetKind);

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="기숙사 생활 방식 룸메와의 소통 비교"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-orange-50"
          aria-hidden="true"
        >
          <Users className="h-3.5 w-3.5 text-orange-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">룸메와의 소통</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            원하는 룸메와의 친밀도를 비교해요.
          </p>
          <ul
            className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-extrabold leading-4"
            aria-label="룸메와의 소통 marker 색상 안내"
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
        aria-label="각자 생활해요 친하게 지내요 룸메와의 소통 막대"
      >
        <div className="relative px-2 pt-2">
          <div className="relative h-5 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div className="grid h-full grid-cols-2" aria-hidden="true">
              {RELATIONSHIP_DISTANCE_OPTIONS.map((option) => (
                <span
                  key={option.id}
                  className={getRelationshipDistanceSegmentClass(option.id, matchedKind)}
                />
              ))}
            </div>
            <RelationshipDistanceMarker
              kind={viewerKind}
              label="나"
              valueLabel={viewerLabel}
              className="bg-indigo-500"
              overlapSide={markersOverlap ? 'left' : 'center'}
            />
            <RelationshipDistanceMarker
              kind={targetKind}
              label="상대"
              valueLabel={targetLabel}
              className="bg-sky-500"
              overlapSide={markersOverlap ? 'right' : 'center'}
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1" aria-label="룸메와의 소통 단계">
          {RELATIONSHIP_DISTANCE_OPTIONS.map((option) => (
            <div
              key={option.id}
              className={`px-2 py-1 text-center text-[10px] font-extrabold leading-4 ${option.labelClassName}`}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RelationshipDistanceMarker({
  kind,
  label,
  valueLabel,
  className,
  overlapSide,
}: {
  readonly kind: RelationshipDistanceKind;
  readonly label: string;
  readonly valueLabel: string;
  readonly className: string;
  readonly overlapSide: 'left' | 'center' | 'right';
}) {
  return (
    <span
      className={`absolute top-1/2 h-4 w-4 rounded-full border-2 border-white shadow-md ${className}`}
      style={{
        left: getRelationshipDistanceLeft(kind),
        transform: getRelationshipDistanceMarkerTransform(overlapSide),
      }}
      aria-label={`${label}: ${valueLabel}`}
    >
      <span className="sr-only">{`${label}: ${valueLabel}`}</span>
    </span>
  );
}

function getRelationshipDistanceMarkerTransform(overlapSide: 'left' | 'center' | 'right') {
  if (overlapSide === 'left') return 'translate(-85%, -50%)';
  if (overlapSide === 'right') return 'translate(-15%, -50%)';
  return 'translate(-50%, -50%)';
}

function inferRelationshipDistance(value: string | undefined): RelationshipDistanceKind {
  if (!value) return 'unknown';
  if (value.includes('친')) return 'close';
  if (value.includes('각자') || value.includes('거리') || value.includes('생활')) return 'casual';
  return 'unknown';
}

function getRelationshipDistanceLeft(kind: RelationshipDistanceKind): string {
  if (kind === 'casual') return '25%';
  if (kind === 'close') return '75%';
  return '50%';
}

function getRelationshipDistanceLabel(kind: RelationshipDistanceKind): string {
  if (kind === 'casual') return '각자 생활해요';
  if (kind === 'close') return '친하게 지내요';
  return '확인 필요';
}

function getMatchedRelationshipDistanceKind(
  viewerKind: RelationshipDistanceKind,
  targetKind: RelationshipDistanceKind,
): Exclude<RelationshipDistanceKind, 'unknown'> | null {
  if (viewerKind === 'unknown' || targetKind === 'unknown') return null;
  return viewerKind === targetKind ? viewerKind : null;
}

function getRelationshipDistanceSegmentClass(
  optionId: Exclude<RelationshipDistanceKind, 'unknown'>,
  matchedKind: Exclude<RelationshipDistanceKind, 'unknown'> | null,
): string {
  const baseClass = 'bg-slate-100';
  if (optionId !== matchedKind) return baseClass;
  return 'bg-emerald-100';
}

type SleepEnvironmentValueKind =
  | 'quiet'
  | 'earphone'
  | 'speaker'
  | 'noSpeaker'
  | 'speakerOk'
  | 'noScreen'
  | 'audio'
  | 'screen'
  | 'lowScreenOk'
  | 'screenOk'
  | 'unknown';

type SleepEnvironmentSupportLevel = 'match' | 'partial' | 'outside';

interface SleepEnvironmentCoordinationChannel {
  readonly id: 'sound' | 'screen';
  readonly title: string;
  readonly axis: CompatibilityAxis | undefined;
  readonly targetKind: SleepEnvironmentValueKind;
  readonly viewerKind: SleepEnvironmentValueKind;
}

function SleepEnvironmentCoordinationCard({
  axes,
}: {
  readonly axes: readonly CompatibilityAxis[];
}) {
  const soundAxis = axes.find((axis) => axis.id === 'SLEEP_ENVIRONMENT');
  const screenAxis = axes.find((axis) => axis.id === 'SCREEN_USAGE');
  const channels = [
    {
      id: 'sound',
      title: '스피커 소리',
      axis: soundAxis,
      targetKind: inferSleepSoundTarget(soundAxis?.comparison.targetText),
      viewerKind: inferSleepSoundPreference(soundAxis?.comparison.viewerText),
    },
    {
      id: 'screen',
      title: '화면 밝기',
      axis: screenAxis,
      targetKind: inferSleepScreenTarget(screenAxis?.comparison.targetText),
      viewerKind: inferSleepScreenPreference(screenAxis?.comparison.viewerText),
    },
  ] as const satisfies readonly [
    SleepEnvironmentCoordinationChannel,
    SleepEnvironmentCoordinationChannel,
  ];

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="취침 전 수면 환경 조율 정보"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-50"
          aria-hidden="true"
        >
          <MonitorSmartphone className="h-3.5 w-3.5 text-sky-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">상대방의 기기 사용 방식</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            잘 때 화면·스피커 사용을 확인해요.
          </p>
        </div>
      </div>

      <SleepEnvironmentDeviceUsagePanel screenChannel={channels[1]} soundChannel={channels[0]} />
    </div>
  );
}

function SleepEnvironmentDeviceUsagePanel({
  screenChannel,
  soundChannel,
}: {
  readonly screenChannel: SleepEnvironmentCoordinationChannel;
  readonly soundChannel: SleepEnvironmentCoordinationChannel;
}) {
  return (
    <div className="mt-3 space-y-3" aria-label="상대방 기기 사용 비교">
      <SleepEnvironmentTwoLaneOverview screenChannel={screenChannel} soundChannel={soundChannel} />
    </div>
  );
}

interface SleepEnvironmentLaneOption {
  readonly id: SleepEnvironmentValueKind;
  readonly label: string;
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const SCREEN_USAGE_LANE_OPTIONS: readonly SleepEnvironmentLaneOption[] = [
  { id: 'noScreen', label: '안 봐요', Icon: Moon },
  { id: 'audio', label: '음악만 들어요', Icon: Headphones },
  { id: 'screen', label: '화면을 봐요', Icon: MonitorSmartphone },
];

const SLEEP_SOUND_LANE_OPTIONS: readonly SleepEnvironmentLaneOption[] = [
  { id: 'quiet', label: '무음', Icon: Moon },
  { id: 'earphone', label: '이어폰 사용', Icon: Headphones },
  { id: 'speaker', label: '스피커로 작게', Icon: Volume2 },
];

function SleepEnvironmentTwoLaneOverview({
  screenChannel,
  soundChannel,
}: {
  readonly screenChannel: SleepEnvironmentCoordinationChannel;
  readonly soundChannel: SleepEnvironmentCoordinationChannel;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="상대방 기기 사용 2-lane">
      <SleepEnvironmentLaneCard
        title="취침 시 화면 밝기"
        rangeTone={screenChannel.axis?.bucketTone ?? 'unknown'}
        targetKind={screenChannel.targetKind}
        viewerLabel={getSleepEnvironmentScreenPreferenceLabel(screenChannel.viewerKind)}
        supportByKind={getSleepEnvironmentScreenSupportByKind(screenChannel.viewerKind)}
        options={SCREEN_USAGE_LANE_OPTIONS}
        note={
          screenChannel.targetKind === 'audio' ? '음악만 듣는 경우는 화면 빛 없음으로 봐요.' : null
        }
      />
      <SleepEnvironmentLaneCard
        title="취침 시 스피커 사용"
        rangeTone={soundChannel.axis?.bucketTone ?? 'unknown'}
        targetKind={soundChannel.targetKind}
        viewerLabel={getSleepEnvironmentSoundPreferenceLabel(soundChannel.viewerKind)}
        supportByKind={getSleepEnvironmentSoundSupportByKind(soundChannel.viewerKind)}
        options={SLEEP_SOUND_LANE_OPTIONS}
        note={soundChannel.targetKind === 'earphone' ? '이어폰 사용은 무음과 같아요.' : null}
      />
    </div>
  );
}

function SleepEnvironmentLaneCard({
  title,
  rangeTone,
  targetKind,
  viewerLabel,
  supportByKind: supportConfig,
  options,
  note,
}: {
  readonly title: string;
  readonly rangeTone: CompatibilityBucketTone;
  readonly targetKind: SleepEnvironmentValueKind;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>>;
  readonly options: readonly SleepEnvironmentLaneOption[];
  readonly note: string | null;
}) {
  const supportByKind = Object.fromEntries(
    options.map((option) => [option.id, supportConfig[option.id] ?? 'outside']),
  ) as Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>;
  const acceptedOptions = options.filter((option) => supportByKind[option.id] !== 'outside');
  const outsideOptions = options.filter((option) => supportByKind[option.id] === 'outside');

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm"
      aria-label={`${title} 2-lane`}
    >
      <div>
        <p className="text-[11px] font-extrabold leading-4 text-slate-900">{title}</p>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className={`text-[10px] font-extrabold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}>
            나의 조건 범위
          </p>
          <p
            className={`text-right text-[10px] font-bold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}
          >
            {viewerLabel}
          </p>
        </div>
        <ul className="grid gap-1.5" aria-label={`${title} 상대방 상태`}>
          {acceptedOptions.length > 0 ? (
            <li
              className={`rounded-2xl border-2 p-1.5 ${RANGE_FRAME_CLASS[rangeTone]}`}
              aria-label={`${title} 나의 조건 범위`}
            >
              <p className="mb-1 px-1 text-[10px] font-extrabold leading-4 text-slate-600">
                {getSleepEnvironmentTargetUsageLabel(title)}
              </p>
              <ul className="grid gap-1.5">
                {acceptedOptions.map((option) => (
                  <SleepEnvironmentLaneOptionItem
                    key={option.id}
                    option={option}
                    active={option.id === targetKind}
                    supportLevel={supportByKind[option.id]}
                  />
                ))}
              </ul>
            </li>
          ) : null}
          {outsideOptions.map((option) => (
            <SleepEnvironmentLaneOptionItem
              key={option.id}
              option={option}
              active={option.id === targetKind}
              supportLevel={supportByKind[option.id]}
            />
          ))}
        </ul>
      </div>

      {note ? (
        <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-sky-700">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function SleepEnvironmentLaneOptionItem({
  option,
  active,
  supportLevel,
}: {
  readonly option: SleepEnvironmentLaneOption;
  readonly active: boolean;
  readonly supportLevel: SleepEnvironmentSupportLevel;
}) {
  const Icon = option.Icon;
  const inRange = supportLevel !== 'outside';
  const itemClassName = active
    ? 'border-sky-300 bg-sky-50/90 text-sky-900 shadow-sm ring-1 ring-sky-200'
    : inRange
      ? 'border-indigo-100 bg-white/85 text-slate-700'
      : 'border-slate-100 bg-slate-50/70 text-slate-500';
  const iconClassName = active
    ? 'bg-white text-sky-700 ring-1 ring-sky-100'
    : 'bg-white/80 text-slate-400';

  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 ${itemClassName}`}
      aria-current={active ? 'true' : undefined}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-keep text-[11px] leading-4 font-extrabold whitespace-normal">
        {option.label}
      </span>
      {active ? (
        <span className="ml-auto hidden shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 min-[361px]:inline-flex">
          상대
        </span>
      ) : null}
    </li>
  );
}

function getSleepEnvironmentTargetUsageLabel(title: string): string {
  return title.includes('화면') ? '상대의 화면 사용' : '상대의 스피커 사용';
}

function getSleepEnvironmentScreenSupportByKind(
  kind: SleepEnvironmentValueKind,
): Partial<Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>> {
  if (kind === 'screenOk') {
    return { noScreen: 'match', audio: 'match', screen: 'match' };
  }
  if (kind === 'lowScreenOk') {
    return { noScreen: 'match', audio: 'match', screen: 'partial' };
  }
  if (kind === 'noScreen') {
    return { noScreen: 'match', audio: 'match' };
  }
  return {};
}

function getSleepEnvironmentSoundSupportByKind(
  kind: SleepEnvironmentValueKind,
): Partial<Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>> {
  if (kind === 'speakerOk') {
    return { quiet: 'match', earphone: 'match', speaker: 'match' };
  }
  if (kind === 'noSpeaker') {
    return { quiet: 'match', earphone: 'match' };
  }
  return {};
}

function getSleepEnvironmentScreenPreferenceLabel(kind: SleepEnvironmentValueKind): string {
  if (kind === 'screenOk') return '화면 OK';
  if (kind === 'lowScreenOk') return '밝기 낮추면 OK';
  if (kind === 'noScreen') return '화면 끄기';
  return '화면 기준 확인 필요';
}

function getSleepEnvironmentSoundPreferenceLabel(kind: SleepEnvironmentValueKind): string {
  if (kind === 'speakerOk') return '작은 소리 OK';
  if (kind === 'noSpeaker') return '스피커 끄기';
  return '소리 기준 확인 필요';
}

function SleepHabitMobileValueCard({
  label,
  value,
  Icon,
  iconClassName,
  iconWrapperClassName,
  ariaLabel,
  className,
  children,
}: {
  readonly label: string;
  readonly value?: string;
  readonly Icon?: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName?: string;
  readonly iconWrapperClassName?: string;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm ${className ?? ''}`}
      aria-label={ariaLabel}
    >
      <p className="text-[10px] font-extrabold leading-4 text-slate-500">{label}</p>
      <div className="mt-1 flex min-h-7 items-center">
        {children ?? (
          <div className="inline-flex min-w-0 items-start gap-1.5">
            {Icon ? (
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconWrapperClassName ?? 'bg-slate-50'}`}
                aria-hidden="true"
              >
                <Icon className={`h-3.5 w-3.5 ${iconClassName ?? 'text-slate-500'}`} />
              </span>
            ) : null}
            <span className="min-w-0 break-keep text-sm leading-5 font-extrabold whitespace-normal text-(--knu-text-primary)">
              {value}
            </span>
          </div>
        )}
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

function inferSleepSoundTarget(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('스피커')) return 'speaker';
  if (value.includes('이어폰')) return 'earphone';
  if (value.includes('안 틀') || value.includes('소리 없음')) return 'quiet';
  return 'unknown';
}

function inferSleepSoundPreference(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('작은 소리') || value.includes('괜찮')) return 'speakerOk';
  if (value.includes('안 틀') || value.includes('껐')) return 'noSpeaker';
  return 'unknown';
}

function inferSleepScreenTarget(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('음악')) return 'audio';
  if (value.includes('화면') || value.includes('봐요') || value.includes('영상')) {
    return value.includes('안 봐') ? 'noScreen' : 'screen';
  }
  if (value.includes('안 봐')) return 'noScreen';
  return 'unknown';
}

function inferSleepScreenPreference(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('밝기 낮추')) return 'lowScreenOk';
  if (value.includes('상관') || value.includes('괜찮')) return 'screenOk';
  if (value.includes('안 켰') || value.includes('안 켜')) return 'noScreen';
  return 'unknown';
}

function SleepRhythmTimeSlotComparison({ axes }: { readonly axes: readonly CompatibilityAxis[] }) {
  const timeAxes = axes.filter((axis) => Boolean(TIME_SLOT_TIMELINE_CONFIG[axis.id]));
  if (timeAxes.length === 0) return null;

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="수면 리듬 시간대 비교"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-sky-700">취침 시간 / 기상 시간</p>
        <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
          시간대 비교
        </span>
      </div>
      <div className="mt-2 h-px bg-sky-100" aria-hidden="true" />
      <div className="mt-3 space-y-2">
        {timeAxes.map((axis) => (
          <TimeSlotTimeline key={axis.id} axis={axis} />
        ))}
      </div>
    </div>
  );
}

interface TimeSlotConfig {
  readonly slots: readonly {
    readonly label: string;
    readonly aliases: readonly string[];
  }[];
  readonly flexibleAliases?: readonly string[];
}

const TIME_SLOT_TIMELINE_CONFIG: Partial<Record<PublicProfileCompatibilityAxisId, TimeSlotConfig>> =
  {
    BEDTIME: {
      slots: [
        { label: '22시 이전', aliases: ['22시 이전'] },
        { label: '22~24시', aliases: ['22~24시'] },
        { label: '24~02시', aliases: ['24~02시'] },
        { label: '02시 이후', aliases: ['02시 이후', '2시 이후'] },
      ],
    },
    WAKE_TIME: {
      slots: [
        { label: '7시 이전', aliases: ['7시 이전'] },
        { label: '7~8시', aliases: ['7~8시'] },
        { label: '8~9시', aliases: ['8~9시'] },
        { label: '9~10시', aliases: ['9~10시'] },
        { label: '10시 이후', aliases: ['10시 이후'] },
      ],
      flexibleAliases: ['수업에 따라 유동적'],
    },
  };

function TimeSlotTimeline({ axis }: { readonly axis: CompatibilityAxis }) {
  const config = TIME_SLOT_TIMELINE_CONFIG[axis.id];
  if (!config) return null;

  const targetSlotIndex = findTimeSlotIndex(config, axis.comparison.targetText);
  const viewerSlotIndex = findTimeSlotIndex(config, axis.comparison.viewerText);
  const targetFlexible = isFlexibleTimeSlot(config, axis.comparison.targetText);
  const viewerFlexible = isFlexibleTimeSlot(config, axis.comparison.viewerText);
  const bothFlexible = targetFlexible && viewerFlexible;
  const desktopGridClass = config.slots.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-5';

  return (
    <div
      className="rounded-2xl border border-sky-100 bg-sky-50 p-2.5"
      aria-label={`${axis.label} 시간대 시각화`}
    >
      <p className="mb-2 text-[11px] font-bold text-sky-700">
        {axis.id === 'BEDTIME' ? '취침' : '기상'}
      </p>
      <div
        className={`rounded-2xl p-1 ${
          viewerFlexible
            ? 'border-2 border-solid border-indigo-300 bg-white'
            : targetFlexible
              ? 'border-2 border-solid border-sky-200 bg-white'
              : ''
        }`}
      >
        <div
          className={`relative rounded-xl ${
            bothFlexible ? 'border-2 border-solid border-sky-300 p-1' : ''
          }`}
        >
          <div className={`grid grid-cols-1 gap-1 ${desktopGridClass}`}>
            {config.slots.map((slot, index) => {
              const markers = [
                ...(targetSlotIndex === index ? ['상대'] : []),
                ...(viewerSlotIndex === index ? ['나'] : []),
              ];
              const slotClassName = getTimeSlotMarkerClassName(markers);

              return (
                <div
                  key={slot.label}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-2 py-1.5 text-left sm:block sm:min-h-14 sm:px-1.5 sm:text-center ${slotClassName}`}
                >
                  <p className="min-w-0 break-keep text-[10px] leading-4 font-bold whitespace-normal">
                    {slot.label}
                  </p>
                  {markers.length > 0 ? (
                    <div className="flex shrink-0 flex-col items-end gap-1 min-[360px]:flex-row min-[360px]:flex-wrap min-[360px]:justify-end sm:mt-1 sm:items-center sm:justify-center">
                      {markers.map((marker) => (
                        <span
                          key={marker}
                          className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                            marker === '상대'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {marker}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {targetFlexible || viewerFlexible ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
          {targetFlexible ? (
            <span className="rounded-full border border-sky-100 bg-sky-100 px-2 py-1 text-sky-700">
              상대 · 유동 일정
            </span>
          ) : null}
          {viewerFlexible ? (
            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-indigo-700">
              나 · 유동 일정
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getTimeSlotMarkerClassName(markers: readonly string[]): string {
  const hasTarget = markers.includes('상대');
  const hasViewer = markers.includes('나');

  if (hasTarget && hasViewer) {
    return 'border-indigo-300 bg-white text-indigo-700 shadow-sm ring-2 ring-sky-200';
  }

  if (hasViewer) {
    return 'border-indigo-200 bg-white text-indigo-700 shadow-sm';
  }

  if (hasTarget) {
    return 'border-sky-200 bg-white text-sky-700 shadow-sm';
  }

  return 'border-slate-100 bg-white/60 text-slate-400';
}

function findTimeSlotIndex(config: TimeSlotConfig, value: string): number | null {
  const index = config.slots.findIndex((slot) =>
    slot.aliases.some((alias) => value.includes(alias)),
  );
  return index === -1 ? null : index;
}

function isFlexibleTimeSlot(config: TimeSlotConfig, value: string): boolean {
  return config.flexibleAliases?.some((alias) => value.includes(alias)) ?? false;
}
