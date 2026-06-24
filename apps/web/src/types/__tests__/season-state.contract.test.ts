import { describe, expect, it } from 'vitest';
import { seasonStateSchema } from '@repo/shared/season/runtime';
import type { SeasonState } from '../season';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEB_SEASON_TYPE_SOURCE = resolve(process.cwd(), 'src/types/season.ts');
const SEASON_API_SOURCE = resolve(process.cwd(), 'src/api/season.ts');

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

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

  it('Web SeasonState type is re-exported from the shared season runtime contract', () => {
    const source = readSource(WEB_SEASON_TYPE_SOURCE);

    expect(source).toContain('@repo/shared/season/runtime');
  });

  it('DevPanel season override can force SEASON_POST_MATCH', () => {
    const source = readSource(SEASON_API_SOURCE);

    expect(source).toContain("override === 'SEASON_POST_MATCH'");
    expect(source).toContain("isPostMatch: override === 'SEASON_POST_MATCH'");
  });
});
