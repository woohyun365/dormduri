import { Filter, X } from 'lucide-react';
import { LIFESTYLE_FIELD_NAMES } from '@/constants/lifestyle';
import type { FilterState } from '@/types/filter';
import type { SortMode, ViewMode } from './useRoommateListViewModel';

interface RoommateListHeaderProps {
  headerTitle: string;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  sortMode: SortMode;
  onSortModeChange: (sortMode: SortMode) => void;
  onOpenFilters: () => void;
  activeFilters: [keyof FilterState, string | null][];
  activeFilterCount: number;
  getFilterLabel: (field: keyof FilterState, value: string) => string;
  onRemoveFilter: (field: keyof FilterState) => void;
  onResetFilters: () => void;
  showViewModeTabs: boolean;
  bookmarkedCount: number;
}

export function RoommateListHeader({
  headerTitle,
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
  onOpenFilters,
  activeFilters,
  activeFilterCount,
  getFilterLabel,
  onRemoveFilter,
  onResetFilters,
  showViewModeTabs,
  bookmarkedCount,
}: RoommateListHeaderProps) {
  return (
    <div
      role="banner"
      className="bg-white border-b-2 border-[var(--knu-border)] px-5 py-4 sticky top-0 z-40"
    >
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-[var(--knu-text-primary)]">{headerTitle}</h1>
      </div>

      {showViewModeTabs && (
        <div className="flex items-center gap-2 mb-3" role="tablist" aria-label="목록 보기 모드">
          <button
            role="tab"
            aria-selected={viewMode === 'all'}
            onClick={() => onViewModeChange('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              viewMode === 'all'
                ? 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
                : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'bookmarked'}
            onClick={() => onViewModeChange('bookmarked')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              viewMode === 'bookmarked'
                ? 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
                : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
            }`}
          >
            관심목록
            {bookmarkedCount > 0 ? ` ${bookmarkedCount}` : ''}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFilters}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 transition-all flex-shrink-0 ${
            activeFilterCount > 0
              ? 'bg-[var(--knu-primary)] text-white border-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)]'
              : 'bg-white text-[var(--knu-text-secondary)] border-[var(--knu-border)] hover:border-[var(--knu-primary)] hover:bg-[var(--knu-primary-light)]'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-semibold">
            필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
          </span>
        </button>

        <button
          onClick={() => onSortModeChange('match')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            sortMode === 'match'
              ? 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
          }`}
        >
          매칭도순
        </button>
        <button
          onClick={() => onSortModeChange('recent')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            sortMode === 'recent'
              ? 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
          }`}
        >
          최근 가입순
        </button>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {activeFilters.map(([field, value]) => (
            <button
              key={field}
              type="button"
              onClick={() => onRemoveFilter(field)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--knu-primary-light)] text-[var(--knu-primary)] text-xs font-semibold rounded-full hover:bg-[var(--knu-primary)] hover:text-white transition-colors"
            >
              {LIFESTYLE_FIELD_NAMES[field]}: {getFilterLabel(field, value!)}
              <X className="w-3 h-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-[var(--knu-text-tertiary)] hover:text-red-500 transition-colors"
          >
            전체 해제
          </button>
        </div>
      )}
    </div>
  );
}
