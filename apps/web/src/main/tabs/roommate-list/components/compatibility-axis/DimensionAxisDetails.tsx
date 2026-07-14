import { ChevronDown } from 'lucide-react';
import { getCompactDetailTheme } from './CompactAxisComparisonCards';
import { CleanSpaceCoordinationCard } from './details/CleanSpaceDetail';
import { DeviceUsageCoordinationCard } from './details/DeviceUsageDetail';
import { RelationshipDistanceComparisonCard } from './details/RelationshipDetail';
import { SleepEnvironmentCoordinationCard } from './details/SleepEnvironmentDetail';
import { SleepHabitSensitivityImpactCard } from './details/SleepHabitDetail';
import { SleepRhythmTimeSlotComparison } from './details/SleepRhythmDetail';
import { SmokingToleranceImpactCard } from './details/SmokingDetail';
import { TemperatureSensitivityComparisonCard } from './details/TemperatureDetail';
import type { CompatibilityAxis, CompatibilityDimension, CompactDetailTheme } from './types';

export function DimensionAxisDetails({
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
