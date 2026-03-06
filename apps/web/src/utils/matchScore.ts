import type { LifestyleData } from '@/types/lifestyle';
import { BEDTIME_ORDER, WAKE_ORDER, NOISE_ORDER, CLEAN_ORDER } from '@/constants/lifestyle';

export { BEDTIME_ORDER, WAKE_ORDER, NOISE_ORDER, CLEAN_ORDER };

const POINTS_PER_FIELD = 12.5;

export function indexDistance(order: readonly string[], a: string, b: string): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return -1;
  return Math.abs(ia - ib);
}

function scoreExactOrOk(mine: string | null, theirs: string | null): number {
  if (mine === null || theirs === null) return POINTS_PER_FIELD;
  if (mine === theirs) return POINTS_PER_FIELD;
  if (mine === 'OK' || theirs === 'OK') return POINTS_PER_FIELD;
  return 0;
}

function scoreExact(mine: string | null, theirs: string | null): number {
  if (mine === null || theirs === null) return POINTS_PER_FIELD;
  return mine === theirs ? POINTS_PER_FIELD : 0;
}

function scoreOrdered(
  mine: string | null,
  theirs: string | null,
  order: readonly string[],
): number {
  if (mine === null || theirs === null) return POINTS_PER_FIELD;
  const dist = indexDistance(order, mine, theirs);
  if (dist === 0) return POINTS_PER_FIELD;
  if (dist === 1) return POINTS_PER_FIELD / 2;
  return 0;
}

export function calcMatchScore(mine: LifestyleData, theirs: LifestyleData): number {
  let score = 0;

  score += scoreExactOrOk(mine.smoker, theirs.smoker);
  score += scoreExact(mine.sleepHabit, theirs.sleepHabit);
  score += scoreExactOrOk(mine.indoorEating, theirs.indoorEating);
  score += scoreOrdered(mine.bedtime, theirs.bedtime, BEDTIME_ORDER);
  score += scoreOrdered(mine.wakeTime, theirs.wakeTime, WAKE_ORDER);
  score += scoreOrdered(mine.noiseSensitivity, theirs.noiseSensitivity, NOISE_ORDER);
  score += scoreOrdered(mine.cleanliness, theirs.cleanliness, CLEAN_ORDER);
  score += scoreExact(mine.relationshipStyle, theirs.relationshipStyle);

  return Math.round(score);
}
