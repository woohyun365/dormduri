import type { LucideIcon } from 'lucide-react';
import { CalendarCheck2, CircleCheckBig, Clock3, Sparkles } from 'lucide-react';
import type { LandingSeasonState } from '../../content/landing-content.types';

export const seasonPolicyPresentation = {
  OFF_SEASON: Clock3,
  SEASON_OPEN: Sparkles,
  SEASON_MATCHING: CircleCheckBig,
  SEASON_POST_MATCH: CalendarCheck2,
} as const satisfies Record<LandingSeasonState, LucideIcon>;
