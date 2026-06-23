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

describe('Web SeasonState contract baseline', () => {
  it('shared season runtime source of truth includes post-match state', () => {
    expect(seasonStateSchema.options).toEqual([
      'OFF_SEASON',
      'SEASON_OPEN',
      'SEASON_MATCHING',
      'SEASON_POST_MATCH',
    ]);
  });

  it('documents the current Web SeasonState compile drift against shared post-match', () => {
    // @ts-expect-error Phase 0 baseline: Web SeasonState intentionally lacks SEASON_POST_MATCH.
    const postMatch: SeasonState = 'SEASON_POST_MATCH';

    expect(postMatch).toBe('SEASON_POST_MATCH');
  });

  it('documents that the Web SeasonState source currently omits shared post-match', () => {
    const source = readSource(WEB_SEASON_TYPE_SOURCE);

    expect(source).toContain('OFF_SEASON');
    expect(source).toContain('SEASON_OPEN');
    expect(source).toContain('SEASON_MATCHING');
    expect(source).not.toContain('SEASON_POST_MATCH');
  });

  it('documents that DevPanel season override currently omits post-match', () => {
    const source = readSource(SEASON_API_SOURCE);

    expect(source).toContain("override === 'SEASON_MATCHING'");
    expect(source).not.toContain("override === 'SEASON_POST_MATCH'");
  });

  it.skip('target: Web SeasonState mirrors every shared season runtime state', () => {
    const source = readSource(WEB_SEASON_TYPE_SOURCE);

    for (const state of seasonStateSchema.options) {
      expect(source).toContain(`'${state}'`);
    }
  });

  it.skip('target: DevPanel season override can force SEASON_POST_MATCH', () => {
    const source = readSource(SEASON_API_SOURCE);

    expect(source).toContain("override === 'SEASON_POST_MATCH'");
  });
});
