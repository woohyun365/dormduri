import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { STATIC_ACTIVITY_METRIC_CLASS_NAMES } from './model/activityStyles';
import type { StaticActivityMetric } from './model/activityTypes';

export function ActivityMetricCell({ metric }: { metric: StaticActivityMetric }) {
  const MetricIcon = metric.icon;
  const toneClassName = STATIC_ACTIVITY_METRIC_CLASS_NAMES[metric.tone ?? 'neutral'];
  const content = (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <MetricIcon className={`size-3.5 ${toneClassName.icon}`} aria-hidden="true" />
        <p className="text-[11px] font-bold text-(--knu-text-tertiary)">{metric.label}</p>
        {metric.onClick && (
          <ChevronRight className="ml-auto size-3 text-(--knu-text-tertiary)" aria-hidden="true" />
        )}
      </div>
      <p className={`flex items-baseline gap-1 text-sm font-extrabold ${toneClassName.value}`}>
        <span>{metric.value}</span>
        {metric.todayNewCount !== undefined && metric.todayNewCount > 0 && (
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-xs font-bold text-green-600"
          >
            (+{metric.todayNewCount}명)
          </motion.span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-(--knu-text-tertiary)">{metric.helper}</p>
    </>
  );

  const className = toneClassName.cell;

  if (metric.onClick) {
    return (
      <button
        type="button"
        onClick={metric.onClick}
        className={`${className} text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
