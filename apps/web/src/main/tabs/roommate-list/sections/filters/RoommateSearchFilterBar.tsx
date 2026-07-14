import {
  buildRoommateFilterSheetViewModel,
  type RoommateFilterSheetViewModel,
} from '../../model/filters/roommateFilterSheetModel';
import type { RoommateSearchManifestModel } from '../../model/filters/roommateSearchManifestModel';
import type {
  RoommateSearchCriteriaFilterKey,
  RoommateSearchQueryCriteria,
} from '../../model/search/roommateSearchQuery';

interface RoommateSearchFilterBarProps {
  readonly manifest: RoommateSearchManifestModel | null;
  readonly query: RoommateSearchQueryCriteria;
  readonly disabled: boolean;
  readonly onOpenFilterSheet: () => void;
  readonly onRemoveFilter: (key: RoommateSearchCriteriaFilterKey) => void;
  readonly onResetFilters: () => void;
}

export function RoommateSearchFilterBar({
  manifest,
  query,
  disabled,
  onOpenFilterSheet,
  onRemoveFilter,
  onResetFilters,
}: RoommateSearchFilterBarProps) {
  const viewModel = buildRoommateFilterSheetViewModel(manifest, query);

  return (
    <section className="space-y-2 border-t border-slate-100 pt-3" aria-label="룸메이트 조건 필터">
      <div className="flex items-center justify-between gap-2">
        <p className="shrink-0 text-xs font-semibold text-(--knu-text-tertiary)">조건 필터</p>
        <button
          type="button"
          disabled={disabled || !viewModel.canOpen}
          onClick={onOpenFilterSheet}
          className="shrink-0 rounded-xl bg-(--knu-primary) px-3 py-2 text-xs font-semibold text-white transition hover:bg-(--knu-primary-hover) disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-(--knu-text-tertiary)"
        >
          필터 열기
        </button>
      </div>

      <ActiveFilterChips
        viewModel={viewModel}
        disabled={disabled}
        onRemoveFilter={onRemoveFilter}
        onResetFilters={onResetFilters}
      />

      {viewModel.policyCopy ? (
        <p className="rounded-2xl bg-(--knu-background-alt) px-4 py-3 text-xs leading-5 text-(--knu-text-secondary)">
          {viewModel.policyCopy}
        </p>
      ) : null}
    </section>
  );
}

function ActiveFilterChips({
  viewModel,
  disabled,
  onRemoveFilter,
  onResetFilters,
}: {
  readonly viewModel: RoommateFilterSheetViewModel;
  readonly disabled: boolean;
  readonly onRemoveFilter: (key: RoommateSearchCriteriaFilterKey) => void;
  readonly onResetFilters: () => void;
}) {
  if (viewModel.activeChips.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 lg:flex-col lg:items-stretch"
      aria-label="적용 중인 필터"
    >
      {viewModel.activeChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={disabled}
          onClick={() => onRemoveFilter(chip.key)}
          className="inline-flex items-center justify-between gap-2 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-(--knu-text-secondary) shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-full lg:text-left"
          aria-label={`${chip.label} ${chip.valueLabel} 필터 제거`}
        >
          <span className="min-w-0 truncate">
            {chip.label}: {chip.valueLabel}
          </span>
          <span className="shrink-0 text-(--knu-text-tertiary)" aria-hidden="true">
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onResetFilters}
        className="rounded-full border border-(--knu-border) px-2.5 py-1.5 text-[11px] font-semibold text-(--knu-primary) transition hover:border-(--knu-primary) disabled:cursor-not-allowed disabled:opacity-50 lg:w-full"
      >
        전체 해제
      </button>
    </div>
  );
}
