import { motion } from 'motion/react';
import { BarChart3, ChevronRight } from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import { ActivityMetricGrid } from './ActivityMetricGrid';
import {
  getStaticActivityButtonClassName,
  STATIC_ACTIVITY_TONE_CLASS_NAMES,
} from './model/activityStyles';
import type {
  StaticActivityAction,
  StaticActivityMetric,
  StaticActivityTone,
} from './model/activityTypes';

function StaticActivityButton({
  action,
  variant,
  tone,
}: {
  action: StaticActivityAction;
  variant: 'primary' | 'secondary';
  tone: StaticActivityTone;
}) {
  const ActionIcon = action.icon ?? BarChart3;
  const resolvedVariant = action.emphasis ?? variant;
  const className = getStaticActivityButtonClassName(resolvedVariant, action.buttonTone ?? tone);

  return (
    <motion.button
      type="button"
      onClick={action.onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${className}`}
    >
      <ActionIcon className="size-4" aria-hidden="true" />
      <span>{action.label}</span>
      {action.trailingIcon && <ChevronRight className="size-4" aria-hidden="true" />}
    </motion.button>
  );
}

export function StaticActivityCard({
  eyebrow,
  title,
  body,
  icon: Icon,
  tone = 'default',
  metrics,
  action,
  secondaryAction,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  icon: React.ElementType;
  tone?: StaticActivityTone;
  metrics?: StaticActivityMetric[];
  action?: StaticActivityAction;
  secondaryAction?: StaticActivityAction;
}) {
  const toneClassName = STATIC_ACTIVITY_TONE_CLASS_NAMES[tone];

  return (
    <section className={sectionCard(toneClassName.section)} aria-labelledby="home-activity-title">
      <div className={sectionHeader}>
        <div>
          <p className={`mb-1 text-xs font-bold ${toneClassName.eyebrow}`}>{eyebrow}</p>
          <h2 id="home-activity-title" className="font-bold text-(--knu-text-primary)">
            {title}
          </h2>
        </div>
        <span
          className={`flex size-10 items-center justify-center rounded-2xl ${toneClassName.iconBox}`}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
      </div>
      {body && <p className="mb-4 text-sm leading-relaxed text-(--knu-text-secondary)">{body}</p>}
      {metrics && metrics.length > 0 && <ActivityMetricGrid metrics={metrics} />}
      {(action || secondaryAction) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {action && <StaticActivityButton action={action} variant="primary" tone={tone} />}
          {secondaryAction && (
            <StaticActivityButton action={secondaryAction} variant="secondary" tone={tone} />
          )}
        </div>
      )}
    </section>
  );
}
