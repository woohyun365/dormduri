import { describe, expect, it } from 'vitest';
import { seasonStateSchema, type SeasonState } from '@repo/shared/season/runtime';
describe('Web SeasonState contract', () => {
  it('shared season runtime source of truth includes post-match state', () => {
    expect(seasonStateSchema.options).toEqual([
      'OFF_SEASON',
      'SEASON_OPEN',
      'SEASON_MATCHING',
      'SEASON_POST_MATCH',
    ]);
  });

  it('Web SeasonState mirrors the shared post-match state at compile time', () => {
    const postMatch: SeasonState = 'SEASON_POST_MATCH';

    expect(postMatch).toBe('SEASON_POST_MATCH');
  });
});
