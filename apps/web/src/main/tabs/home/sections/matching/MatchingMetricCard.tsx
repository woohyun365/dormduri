import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import type { ComponentType, ReactNode } from 'react';

export type MatchingMetricTone = 'amber' | 'purple' | 'teal' | 'indigo' | 'cyan' | 'slate';

const metricToneClassName: Record<MatchingMetricTone, string> = {
  amber: 'bg-(--knu-background-alt) hover:bg-amber-50 text-amber-600',
  purple: 'bg-(--knu-background-alt) hover:bg-purple-50 text-purple-600',
  teal: 'bg-(--knu-background-alt) hover:bg-teal-50 text-teal-600',
  indigo: 'border-indigo-100 bg-indigo-50/75 text-indigo-700',
  cyan: 'border-cyan-100 bg-cyan-50/75 text-cyan-700',
  slate: 'border-slate-200 bg-white/80 text-slate-700',
};

const metricTextClassName: Record<MatchingMetricTone, string> = {
  amber: 'text-amber-600',
  purple: 'text-purple-600',
  teal: 'text-teal-600',
  indigo: 'text-indigo-700',
  cyan: 'text-cyan-700',
  slate: 'text-slate-700',
};

const iconToneClassName: Record<MatchingMetricTone, string> = {
  amber: 'bg-amber-100 text-amber-600',
  purple: 'bg-purple-100 text-purple-600',
  teal: 'bg-teal-100 text-teal-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  slate: 'bg-slate-100 text-slate-600',
};

export function MatchingMetricActionCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  maxSlots,
  expiringCount,
  onClick,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: number;
  helper: string;
  tone: 'amber' | 'purple' | 'teal';
  maxSlots?: number;
  expiringCount?: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative flex flex-col items-center rounded-xl p-3 transition-colors ${metricToneClassName[tone]}`}
    >
      {tone === 'purple' && value > 0 && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-purple-400"
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <div
        className={`relative z-10 mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${iconToneClassName[tone]}`}
      >
        <Icon className="h-5 w-5" aria-hidden={true} />
      </div>
      {tone === 'purple' ? (
        <AnimatedCounter
          value={value}
          className={`text-xl font-bold ${metricTextClassName[tone]}`}
        />
      ) : (
        <span className={`text-xl font-bold ${metricTextClassName[tone]}`}>
          {maxSlots ? `${value}/${maxSlots}` : value}
        </span>
      )}
      <span className="mt-0.5 text-xs font-medium text-(--knu-text-tertiary)">{label}</span>
      <span className={`mt-0.5 text-[10px] ${metricTextClassName[tone]}`}>{helper}</span>
      {maxSlots ? (
        <div className="mt-1.5 flex items-center gap-1">
          {Array.from({ length: maxSlots }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full transition-all ${
                index < value ? 'bg-amber-600' : 'bg-gray-300'
              }`}
              aria-hidden={true}
            />
          ))}
        </div>
      ) : null}
      {expiringCount && expiringCount > 0 ? (
        <div className="mt-1.5 flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5">
          <AlertTriangle className="h-2.5 w-2.5 text-orange-600" aria-hidden={true} />
          <span className="text-[9px] font-medium text-orange-600">{expiringCount}건 곧 만료</span>
        </div>
      ) : null}
    </motion.button>
  );
}

export function ActiveMatchMetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  helper: string;
  tone: 'indigo' | 'cyan' | 'amber' | 'slate';
}) {
  const toneClassName =
    tone === 'amber' ? 'border-amber-100 bg-amber-50/80 text-amber-700' : metricToneClassName[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClassName}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden={true} />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{helper}</p>
    </div>
  );
}

export function MatchingHelperMessage({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700">
      {icon}
      <span>{children}</span>
    </div>
  );
}
