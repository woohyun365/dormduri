import type { LifestyleData } from './lifestyle';

export interface FilterState {
  smoker: LifestyleData['smoker'];
  bedtime: LifestyleData['bedtime'];
  wakeTime: LifestyleData['wakeTime'];
  noiseSensitivity: LifestyleData['noiseSensitivity'];
  cleanliness: LifestyleData['cleanliness'];
  sleepHabit: LifestyleData['sleepHabit'];
  indoorEating: LifestyleData['indoorEating'];
  relationshipStyle: LifestyleData['relationshipStyle'];
}

export const DEFAULT_FILTERS: FilterState = {
  smoker: null,
  bedtime: null,
  wakeTime: null,
  noiseSensitivity: null,
  cleanliness: null,
  sleepHabit: null,
  indoorEating: null,
  relationshipStyle: null,
};
