import type { CompatibilityChartViewModel } from '../model/compatibility/compatibilityChart.mapper';

interface CompatibilityAxisListProps {
  readonly viewModel: CompatibilityChartViewModel;
}

const TONE_CLASS: Record<CompatibilityChartViewModel['axes'][number]['bucketTone'], string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-slate-100 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};

export function CompatibilityAxisList({ viewModel }: CompatibilityAxisListProps) {
  return (
    <section aria-labelledby="roommate-compatibility-axis-heading" className="space-y-3">
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

      <ul className="grid gap-2" aria-label="축별 적합도 목록">
        {viewModel.axes.map((axis) => (
          <li key={axis.id} className="rounded-2xl border border-(--knu-border) bg-white px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-(--knu-text-primary)">{axis.label}</p>
                <p className="mt-1 text-xs text-(--knu-text-secondary)">{axis.scoreLabel}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${TONE_CLASS[axis.bucketTone]}`}
              >
                {axis.bucketLabel}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {viewModel.hiddenNotices.length > 0 ? (
        <ul className="space-y-1" aria-label="정책상 제외된 적합도 안내">
          {viewModel.hiddenNotices.map((notice) => (
            <li key={notice} className="text-xs leading-5 text-(--knu-text-secondary)">
              {notice}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
