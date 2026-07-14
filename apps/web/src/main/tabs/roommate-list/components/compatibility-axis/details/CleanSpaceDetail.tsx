import { Info, Sparkles, Utensils } from 'lucide-react';
import {
  TwoLaneRangeCard,
  type TwoLaneOption,
  type TwoLaneSupportLevel,
} from '../primitives/TwoLaneRangeCard';
import type { CompatibilityAxis } from '../types';

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

type CleanSpaceSupportLevel = TwoLaneSupportLevel;

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

type CleanSpaceLaneOption = TwoLaneOption<CleanSpaceValueKind>;

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

export function CleanSpaceCoordinationCard({
  axes,
}: {
  readonly axes: readonly CompatibilityAxis[];
}) {
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
          <TwoLaneRangeCard
            key={channel.id}
            title={channel.title}
            targetUsageLabel={channel.targetUsageLabel}
            rangeTone={channel.axis?.bucketTone ?? 'unknown'}
            targetKind={channel.targetKind}
            viewerLabel={channel.viewerLabel}
            supportByKind={channel.supportByKind}
            options={channel.options}
            note={channel.note ? { text: channel.note, Icon: Info } : null}
          />
        ))}
      </div>
    </div>
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
