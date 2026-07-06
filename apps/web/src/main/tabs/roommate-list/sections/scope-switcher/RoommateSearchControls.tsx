import type { RoommateSearchManifestModel } from '../../model/filters/roommateSearchManifestModel';
import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';

type RoommateSearchScopeAvailability =
  | RoommateSearchResponse['scopeAvailability']
  | RoommateSearchManifestResponse['scopeAvailability'];

const SEARCH_SCOPES: readonly RoommateSearchScope[] = ['CAMPUS_MERGED', 'SAME_BUILDING_ONLY'];

interface RoommateSearchControlsProps {
  readonly scope: RoommateSearchScope;
  readonly sort: RoommateSearchSort;
  readonly manifest: RoommateSearchManifestModel | null;
  readonly scopeAvailability: RoommateSearchScopeAvailability | null;
  readonly disabled: boolean;
  readonly onScopeChange: (scope: RoommateSearchScope) => void;
  readonly onSortChange: (sort: RoommateSearchSort) => void;
}

export function RoommateSearchControls({
  scope,
  sort,
  manifest,
  scopeAvailability,
  disabled,
  onScopeChange,
  onSortChange,
}: RoommateSearchControlsProps) {
  const sortOptions = manifest?.sortOptions ?? [sort];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--knu-text-tertiary)]">탐색 범위</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="탐색 범위">
          {SEARCH_SCOPES.map((nextScope) => {
            const active = scope === nextScope;
            const available = isScopeAvailable(scopeAvailability, scope, nextScope);
            return (
              <button
                key={nextScope}
                type="button"
                disabled={disabled || active || !available}
                onClick={() => onScopeChange(nextScope)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'bg-[var(--knu-primary)] text-white'
                    : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
                }`}
              >
                {scopeLabel(nextScope)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[var(--knu-text-tertiary)]">정렬</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="정렬">
          {sortOptions.map((nextSort) => {
            const active = sort === nextSort;
            return (
              <button
                key={nextSort}
                type="button"
                disabled={disabled || active}
                onClick={() => onSortChange(nextSort)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'bg-[var(--knu-primary)] text-white'
                    : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
                }`}
              >
                {sortLabel(nextSort)}
              </button>
            );
          })}
        </div>
      </div>

      {manifest && !manifest.canOpenFilterSheet ? (
        <p className="rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-xs leading-5 text-[var(--knu-text-secondary)]">
          현재 시즌 정책상 상세 필터는 열리지 않아요.
        </p>
      ) : null}
    </div>
  );
}

function isScopeAvailable(
  availability: RoommateSearchScopeAvailability | null,
  activeScope: RoommateSearchScope,
  candidate: RoommateSearchScope,
): boolean {
  if (!availability) return activeScope === candidate;
  return candidate === 'CAMPUS_MERGED' ? availability.campusMerged : availability.sameBuildingOnly;
}

function scopeLabel(scope: RoommateSearchScope): string {
  return scope === 'CAMPUS_MERGED' ? '캠퍼스 전체' : '같은 건물';
}

function sortLabel(sort: RoommateSearchSort): string {
  return sort === 'MATCH_SCORE' ? '적합도순' : '닉네임순';
}
