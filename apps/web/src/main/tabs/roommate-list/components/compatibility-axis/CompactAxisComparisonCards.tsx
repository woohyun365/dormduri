import { AXIS_VISUAL_CONFIG } from './axisVisualConfig';
import { TONE_BORDER_CLASS } from './axisTone';
import type { PublicProfileCompatibilityAxisId } from '@repo/shared/profile/contract';
import type { CompatibilityAxis, CompatibilityDimension, CompactDetailTheme } from './types';

export function DimensionAxisComparisonCards({
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

export function getCompactDetailTheme(
  _dimensionId: CompatibilityDimension['id'],
): CompactDetailTheme | undefined {
  return {
    container: 'border-sky-100 bg-sky-50/70',
    list: 'border-sky-100 bg-sky-50/50',
    empty: 'border-sky-100 bg-white/80',
    title: 'text-sky-700',
  };
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
