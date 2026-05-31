import type { ResolvedVisibleProfileEntry } from './visible-profile-owner.js';

export interface RoommateSearchDiscoveryFilterResult {
  entries: ResolvedVisibleProfileEntry[];
  matchedTargetsExcluded: boolean;
}

export function filterRoommateSearchDiscoveryEntries(
  entries: ResolvedVisibleProfileEntry[],
  input: { excludeMatchedTargets: boolean },
): RoommateSearchDiscoveryFilterResult {
  const filtered = input.excludeMatchedTargets
    ? entries.filter((entry) => !entry.targetMatched)
    : entries;

  return {
    entries: filtered,
    matchedTargetsExcluded: filtered.length !== entries.length,
  };
}
