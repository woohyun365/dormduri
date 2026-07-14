import { ListChecks } from 'lucide-react';
import { BAR_CLASS, TONE_CLASS } from './axisTone';
import { DimensionAxisComparisonCards } from './CompactAxisComparisonCards';
import { DimensionAxisDetails } from './DimensionAxisDetails';
import type { CompatibilityAxis, CompatibilityAxisListProps } from './types';

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
