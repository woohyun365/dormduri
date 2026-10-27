import {
  LIFESTYLE_FIELD_OPTIONS,
  formatLifestyleOptionLabel,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import { buildPublicProfileCompatibility } from '@repo/shared/profile';
import { describe, expect, it } from 'vitest';
import { comparePairs } from './demoData';

// The statement's answer sheets lay my answer on the other person's per pair; the pairs
// must be the ones the app compares and shows.
const empty = Object.fromEntries(
  Object.keys(LIFESTYLE_FIELD_OPTIONS).map((field) => [field, null]),
) as LifestyleData;

describe('comparePairs', () => {
  it('covers every public comparison axis once', () => {
    const axes = buildPublicProfileCompatibility(empty, empty).axes.map((axis) => axis.id);
    expect([...comparePairs.map((pair) => pair.axis)].sort()).toEqual([...axes].sort());
  });

  it.each(comparePairs)('$axis compares my $mine with their $theirs', (pair) => {
    const mineOptions = LIFESTYLE_FIELD_OPTIONS[pair.mine] as readonly string[];
    const theirOptions = LIFESTYLE_FIELD_OPTIONS[pair.theirs] as readonly string[];
    // Different answers on the two sides, so a same-field pair still tells the sides apart.
    const mine = mineOptions[0] ?? null;
    const theirs = theirOptions[theirOptions.length - 1] ?? null;
    const axis = buildPublicProfileCompatibility(
      { ...empty, [pair.mine]: mine },
      { ...empty, [pair.theirs]: theirs },
    ).axes.find((entry) => entry.id === pair.axis);
    expect(axis?.comparison).toEqual({
      viewerText: formatLifestyleOptionLabel(pair.mine, mine),
      targetText: formatLifestyleOptionLabel(pair.theirs, theirs),
    });
  });
});
