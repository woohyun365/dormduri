import type { MatchOverviewSeason } from '@repo/shared/match/contract';
import type { SeasonState } from '@repo/shared/season/runtime';

export interface MatchingSeasonShell {
  readonly id: string | null;
  readonly state: SeasonState | null;
}

export type MatchingShellConsistency =
  | { readonly kind: 'consistent'; readonly nextMismatchCount: 0 }
  | { readonly kind: 'transitioning'; readonly nextMismatchCount: 1 }
  | { readonly kind: 'mismatch'; readonly nextMismatchCount: number };

export function resolveMatchingShellConsistency(input: {
  readonly shell: MatchingSeasonShell;
  readonly overview: MatchOverviewSeason;
  readonly consecutiveMismatchCount: number;
}): MatchingShellConsistency {
  const stateMatches = input.shell.state === input.overview.state;
  const idMatches = input.shell.id === input.overview.id;

  if (stateMatches && idMatches) return { kind: 'consistent', nextMismatchCount: 0 };

  const nextMismatchCount = input.consecutiveMismatchCount + 1;
  if (nextMismatchCount === 1) return { kind: 'transitioning', nextMismatchCount };
  return { kind: 'mismatch', nextMismatchCount };
}
