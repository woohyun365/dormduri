import { Sparkles } from 'lucide-react';
import { CompatibilityAxisList } from '../../components/CompatibilityAxisList';
import { CompatibilityRadar } from '../../components/CompatibilityRadar';
import {
  mapCompatibilityToChartViewModel,
  type CompatibilityChartViewModel,
} from '../../model/compatibility/compatibilityChart.mapper';
import type { PublicProfileFullDetail } from '@repo/shared/profile/contract';

const INSIGHT_TONE_CLASS: Record<
  CompatibilityChartViewModel['dimensions'][number]['bucketTone'],
  string
> = {
  high: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-blue-100 bg-blue-50 text-blue-700',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function ProfileCompatibilitySection({
  compatibility,
}: {
  readonly compatibility: PublicProfileFullDetail['compatibility'];
}) {
  const viewModel = compatibility ? mapCompatibilityToChartViewModel(compatibility) : null;

  if (!viewModel) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-800">
          서버 오류로 매칭점수를 제공하지 못했어요.
        </p>
        <p className="mt-1 text-xs leading-5 text-amber-700">
          목록을 새로고침해 다시 확인해 주세요.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-4">
      <div>
        <p className="text-xs font-bold text-indigo-700">생활패턴 비교</p>
        <h3 className="mt-1 text-base font-bold text-(--knu-text-primary)">
          생활패턴 적합도 분석 결과
        </h3>
        <CompatibilityLegend />
      </div>
      <CompatibilityInsightBadges viewModel={viewModel} />
      <CompatibilityRadar viewModel={viewModel} />
      <CompatibilityAxisList viewModel={viewModel} />
    </section>
  );
}

function CompatibilityInsightBadges({
  viewModel,
}: {
  readonly viewModel: CompatibilityChartViewModel;
}) {
  const alignedOrAdjustablePoints = viewModel.dimensions.filter(
    (dimension) => dimension.bucketTone === 'high' || dimension.bucketTone === 'medium',
  );
  const mismatchPoints = viewModel.dimensions.filter((dimension) => dimension.bucketTone === 'low');

  return (
    <section
      aria-labelledby="roommate-compatibility-insight-heading"
      className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm"
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-bold text-indigo-700">핵심 포인트</p>
          <h3
            id="roommate-compatibility-insight-heading"
            className="mt-1 text-sm font-bold text-(--knu-text-primary)"
          >
            먼저 확인하면 좋은 포인트
          </h3>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CompatibilityInsightGroup
          title="잘 맞는 부분 / 대화로 맞출 부분"
          emptyCopy="잘 맞는 부분이 뚜렷하지 않아요."
          axes={alignedOrAdjustablePoints}
        />
        <CompatibilityInsightGroup
          title="잘 안 맞는 부분"
          emptyCopy="크게 어긋나는 부분은 많지 않아요."
          axes={mismatchPoints}
        />
      </div>
    </section>
  );
}

function CompatibilityInsightGroup({
  title,
  emptyCopy,
  axes,
}: {
  readonly title: string;
  readonly emptyCopy: string;
  readonly axes: readonly CompatibilityChartViewModel['dimensions'][number][];
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-3">
      <p className="text-xs font-bold text-(--knu-text-secondary)">{title}</p>
      {axes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {axes.map((axis) => (
            <span
              key={`${title}-${axis.id}`}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                INSIGHT_TONE_CLASS[axis.bucketTone]
              }`}
            >
              {axis.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">{emptyCopy}</p>
      )}
    </div>
  );
}

function CompatibilityLegend() {
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="text-[11px] font-bold text-(--knu-text-tertiary)">색상별 의미: </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="적합도 색상 안내">
        <CompatibilityLegendItem className="bg-emerald-500" label="잘 맞음" />
        <CompatibilityLegendItem className="bg-blue-500" label="조율 가능" />
        <CompatibilityLegendItem className="bg-slate-400" label="서로 다름" />
      </ul>
    </div>
  );
}

function CompatibilityLegendItem({
  className,
  label,
}: {
  readonly className: string;
  readonly label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
      <span className={`h-2 w-2 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </li>
  );
}
