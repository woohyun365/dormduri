import { ActivityMetricCell } from './ActivityMetricCell';
import type { StaticActivityMetric } from './model/activityTypes';

export function ActivityMetricGrid({ metrics }: { metrics: StaticActivityMetric[] }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {metrics.map((metric) => (
        <ActivityMetricCell key={metric.label} metric={metric} />
      ))}
    </div>
  );
}
