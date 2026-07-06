import { RefreshCw } from 'lucide-react';
import { RoommateSummaryCard } from '../../components/RoommateSummaryCard';
import type { RoommateSummaryCardViewModel } from '../../model/search/roommateSearchViewModel';
import type { RoommateApiError } from '../../api/roommateSearch.client';
import type { BookmarkEmptyStateCode, BookmarkSort } from '@repo/shared/social-safety/bookmark';

interface RoommateBookmarkResultsSectionProps {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly sort: BookmarkSort;
  readonly items: readonly RoommateSummaryCardViewModel[];
  readonly emptyState: BookmarkEmptyStateCode | null;
  readonly error: RoommateApiError | null;
  readonly canLoadMore: boolean;
  readonly onSortChange: (sort: BookmarkSort) => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly onBookmarkToggle: (targetUserId: string, bookmarked: boolean) => void;
}

const BOOKMARK_SORTS: readonly BookmarkSort[] = ['RECENT', 'MATCH_SCORE'];

export function RoommateBookmarkResultsSection({
  status,
  sort,
  items,
  emptyState,
  error,
  canLoadMore,
  onSortChange,
  onLoadMore,
  onRetry,
  onBookmarkToggle,
}: RoommateBookmarkResultsSectionProps) {
  return (
    <section className="space-y-4" aria-label="룸메이트 관심 목록">
      <div className="rounded-3xl border border-[var(--knu-border)] bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-[var(--knu-text-primary)]">관심 목록</p>
        <p className="mt-1 text-xs leading-5 text-[var(--knu-text-secondary)]">
          저장한 룸메이트는 bookmark owner API 기준으로 다시 확인해요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="관심 목록 정렬">
          {BOOKMARK_SORTS.map((nextSort) => (
            <button
              key={nextSort}
              type="button"
              disabled={status === 'loading' || sort === nextSort}
              onClick={() => onSortChange(nextSort)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                sort === nextSort
                  ? 'bg-[var(--knu-primary)] text-white'
                  : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
              }`}
            >
              {bookmarkSortLabel(nextSort)}
            </button>
          ))}
        </div>
      </div>

      {status === 'error' ? (
        <section
          role="alert"
          className="rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-600">
            {error?.message ?? '관심 목록을 불러오지 못했어요.'}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--knu-primary-dark)]"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
        </section>
      ) : null}

      {status === 'loading' && items.length === 0 ? (
        <section
          role="status"
          className="rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
            관심 목록을 불러오는 중이에요.
          </p>
        </section>
      ) : null}

      {status !== 'error' && items.length === 0 && status !== 'loading' ? (
        <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
            {bookmarkEmptyTitle(emptyState)}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
            {bookmarkEmptyMessage(emptyState)}
          </p>
        </section>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <RoommateSummaryCard item={item} onBookmarkToggle={onBookmarkToggle} />
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 && canLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="w-full rounded-2xl border-2 border-[var(--knu-border)] bg-white py-3 text-sm font-semibold text-[var(--knu-primary)] transition-all hover:border-[var(--knu-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          더 보기
        </button>
      ) : null}
    </section>
  );
}

function bookmarkSortLabel(sort: BookmarkSort): string {
  return sort === 'MATCH_SCORE' ? '적합도순' : '최근 저장순';
}

function bookmarkEmptyTitle(code: BookmarkEmptyStateCode | null): string {
  if (code === 'NO_VISIBLE_BOOKMARKS') return '저장한 항목이 현재 정책상 보이지 않아요.';
  return '아직 관심 목록에 저장한 룸메이트가 없어요.';
}

function bookmarkEmptyMessage(code: BookmarkEmptyStateCode | null): string {
  if (code === 'NO_VISIBLE_BOOKMARKS') {
    return '숨김 사유나 대상 정보는 노출하지 않고, 다시 볼 수 있는 항목만 표시해요.';
  }
  return '검색 결과에서 관심 목록에 저장하면 이곳에서 다시 확인할 수 있어요.';
}
