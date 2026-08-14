import {
  AlarmClock,
  Cigarette,
  Headphones,
  MonitorSmartphone,
  Moon,
  Phone,
  Sparkles,
  Thermometer,
  Utensils,
  Users,
} from 'lucide-react';
import { IconEar } from '@tabler/icons-react';
import type { PublicProfileCompatibilityAxisId } from '@repo/shared/profile/contract';
import type { AxisVisualConfig } from './types';

export const AXIS_VISUAL_CONFIG: Record<PublicProfileCompatibilityAxisId, AxisVisualConfig> = {
  SMOKING: {
    Icon: Cigarette,
    iconClassName: 'text-rose-500',
    iconWrapperClassName: 'bg-rose-50',
  },
  SLEEP_HABIT: {
    Icon: IconEar,
    iconClassName: 'text-indigo-500',
    iconWrapperClassName: 'bg-indigo-50',
  },
  PHONE: {
    Icon: Phone,
    iconClassName: 'text-blue-500',
    iconWrapperClassName: 'bg-blue-50',
  },
  EARPHONE: {
    Icon: Headphones,
    iconClassName: 'text-indigo-500',
    iconWrapperClassName: 'bg-indigo-50',
  },
  SLEEP_ENVIRONMENT: {
    Icon: Moon,
    iconClassName: 'text-sky-500',
    iconWrapperClassName: 'bg-sky-50',
  },
  SCREEN_USAGE: {
    Icon: MonitorSmartphone,
    iconClassName: 'text-violet-500',
    iconWrapperClassName: 'bg-violet-50',
  },
  CLEAN_LEVEL: {
    Icon: Sparkles,
    iconClassName: 'text-emerald-500',
    iconWrapperClassName: 'bg-emerald-50',
  },
  INDOOR_EATING: {
    Icon: Utensils,
    iconClassName: 'text-orange-500',
    iconWrapperClassName: 'bg-orange-50',
  },
  BEDTIME: {
    Icon: Moon,
    iconClassName: 'text-amber-500',
    iconWrapperClassName: 'bg-amber-50',
  },
  WAKE_TIME: {
    Icon: AlarmClock,
    iconClassName: 'text-cyan-500',
    iconWrapperClassName: 'bg-cyan-50',
  },
  TEMPERATURE: {
    Icon: Thermometer,
    iconClassName: 'text-red-500',
    iconWrapperClassName: 'bg-red-50',
  },
  RELATIONSHIP: {
    Icon: Users,
    iconClassName: 'text-orange-500',
    iconWrapperClassName: 'bg-orange-50',
  },
};
