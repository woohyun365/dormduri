import type { CompatibilityChartViewModel } from '../model/compatibility/compatibilityChart.mapper';

interface CompatibilityRadarProps {
  readonly viewModel: CompatibilityChartViewModel;
}

const GRID_RADII = [12, 24, 36] as const;

export function CompatibilityRadar({ viewModel }: CompatibilityRadarProps) {
  return (
    <section
      aria-labelledby="roommate-compatibility-radar-heading"
      className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id="roommate-compatibility-radar-heading"
          className="text-sm font-bold text-[var(--knu-text-primary)]"
        >
          적합도 한눈에 보기
        </h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--knu-primary)] shadow-sm">
          {viewModel.overallScoreLabel}
        </span>
      </div>

      <svg
        viewBox="0 0 100 100"
        className="mt-4 h-64 w-full"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {GRID_RADII.map((radius) => (
          <circle
            key={radius}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-indigo-100"
            strokeWidth="0.8"
          />
        ))}
        {viewModel.points.map((point) => (
          <line
            key={point.id}
            x1="50"
            y1="50"
            x2={point.labelX}
            y2={point.labelY}
            stroke="currentColor"
            className="text-indigo-100"
            strokeWidth="0.8"
          />
        ))}
        <polygon
          points={viewModel.polygonPoints}
          fill="rgb(79 70 229 / 0.18)"
          stroke="rgb(79 70 229)"
          strokeWidth="1.8"
        />
        {viewModel.points.map((point) => (
          <circle
            key={`${point.id}-point`}
            cx={point.x}
            cy={point.y}
            r="1.8"
            fill="rgb(79 70 229)"
          />
        ))}
      </svg>
      <p className="sr-only">정확한 축별 값은 축별 적합도 목록에서 확인할 수 있어요.</p>
    </section>
  );
}
