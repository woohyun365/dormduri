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
    <section className="space-y-3" aria-label="룸메이트 상세 필터">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--knu-text-tertiary)]">상세 필터</p>
          <p className="mt-1 text-xs leading-5 text-[var(--knu-text-secondary)]">
            현재 탐색 범위에서 허용된 조건만 적용돼요.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || !viewModel.canOpen}
          onClick={onOpenFilterSheet}
          className="shrink-0 rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--knu-primary-dark)] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-[var(--knu-text-tertiary)]"
        >
          필터 열기
        </button>
      </div>

      {viewModel.policyCopy ? (
        <p className="rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-xs leading-5 text-[var(--knu-text-secondary)]">
          {viewModel.policyCopy}
        </p>
      ) : null}

      <ActiveFilterChips
        viewModel={viewModel}
        disabled={disabled}
        onRemoveFilter={onRemoveFilter}
        onResetFilters={onResetFilters}
      />
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
    return (
      <p className="rounded-2xl bg-white px-4 py-3 text-xs text-[var(--knu-text-tertiary)] shadow-sm">
        적용 중인 상세 필터가 없어요.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label="적용 중인 필터">
      {viewModel.activeChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={disabled}
          onClick={() => onRemoveFilter(chip.key)}
          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--knu-text-secondary)] shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${chip.label} ${chip.valueLabel} 필터 제거`}
        >
          {chip.label}: {chip.valueLabel} ×
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onResetFilters}
        className="rounded-full border border-[var(--knu-border)] px-3 py-2 text-xs font-semibold text-[var(--knu-primary)] transition hover:border-[var(--knu-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        전체 해제
      </button>
    </div>
  );
}
