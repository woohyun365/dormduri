import type { RoommateSearchManifestModel } from '../../model/filters/roommateSearchManifestModel';
import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';

type RoommateSearchScopeAvailability =
  RoommateSearchResponse['scopeAvailability'] | RoommateSearchManifestResponse['scopeAvailability'];

const SEARCH_SCOPES: readonly RoommateSearchScope[] = ['CAMPUS_MERGED', 'SAME_BUILDING_ONLY'];

interface RoommateSearchControlsProps {
  readonly scope: RoommateSearchScope;
  readonly sort: RoommateSearchSort;
  readonly manifest: RoommateSearchManifestModel | null;
  readonly scopeAvailability: RoommateSearchScopeAvailability | null;
  readonly disabled: boolean;
  readonly showSort?: boolean;
  readonly onScopeChange: (scope: RoommateSearchScope) => void;
  readonly onSortChange: (sort: RoommateSearchSort) => void;
}

export function RoommateSearchControls({
  scope,
  sort,
  manifest,
  scopeAvailability,
  disabled,
  showSort = true,
  onScopeChange,
  onSortChange,
}: RoommateSearchControlsProps) {
  const sortOptions = manifest?.sortOptions ?? [sort];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-(--knu-text-tertiary)">탐색 범위</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="탐색 범위">
          {SEARCH_SCOPES.map((nextScope) => {
            const active = scope === nextScope;
            const available = isScopeAvailable(scopeAvailability, scope, nextScope);
            return (
              <button
                key={nextScope}
                type="button"
                disabled={disabled || !available}
                onClick={() => {
                  if (!active) onScopeChange(nextScope);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'bg-blue-800 text-white shadow-sm ring-1 ring-blue-800 hover:bg-blue-900 disabled:opacity-100 disabled:hover:bg-blue-800'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {scopeLabel(nextScope)}
              </button>
            );
          })}
        </div>
      </div>

      {showSort ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-(--knu-text-tertiary)">정렬</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="정렬">
            {sortOptions.map((nextSort) => {
              const active = sort === nextSort;
              return (
                <button
                  key={nextSort}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!active) onSortChange(nextSort);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? 'bg-blue-800 text-white shadow-sm ring-1 ring-blue-800 hover:bg-blue-900 disabled:opacity-100 disabled:hover:bg-blue-800'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {sortLabel(nextSort)}
                </button>
              );
            })}
          </div>
        </div>
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
  return sort === 'MATCH_SCORE' ? '매칭도순' : '닉네임순';
}
