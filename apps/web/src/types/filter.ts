import type { LifestyleData } from './lifestyle';

export interface FilterState {
  smokingBehavior: LifestyleData['smokingBehavior'];
  bedtime: LifestyleData['bedtime'];
  wakeTime: LifestyleData['wakeTime'];
  noiseSensitivity: LifestyleData['noiseSensitivity'];
  cleanLevel: LifestyleData['cleanLevel'];
  sleepHabit: LifestyleData['sleepHabit'] | 'HAS';
  indoorEating: LifestyleData['indoorEating'];
  relationshipStyle: LifestyleData['relationshipStyle'];
}

export const DEFAULT_FILTERS: FilterState = {
  smokingBehavior: null,
  bedtime: null,
  wakeTime: null,
  noiseSensitivity: null,
  cleanLevel: null,
  sleepHabit: null,
  indoorEating: null,
  relationshipStyle: null,
};
