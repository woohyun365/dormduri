import type { CompatibilityBucketTone } from './types';

export const TONE_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-slate-100 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};

export const TONE_BORDER_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-blue-100 bg-blue-50 text-blue-700',
  low: 'border-slate-200 bg-slate-100 text-slate-700',
  unknown: 'border-slate-200 bg-slate-100 text-slate-600',
};

export const BAR_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
  unknown: 'bg-slate-300',
};

export const RANGE_FRAME_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'border-emerald-200 bg-emerald-50/30',
  medium: 'border-blue-200 bg-blue-50/30',
  low: 'border-slate-300 bg-slate-50/70',
  unknown: 'border-slate-200 bg-slate-50/50',
};

export const RANGE_TEXT_CLASS: Record<CompatibilityBucketTone, string> = {
  high: 'text-emerald-700',
  medium: 'text-blue-700',
  low: 'text-slate-700',
  unknown: 'text-slate-600',
};
