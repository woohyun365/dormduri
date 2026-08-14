import { RoommateSummaryCard } from '../../components/RoommateSummaryCard';
import type { RoommateSummaryCardViewModel } from '../../model/search/roommateSearchViewModel';

interface RoommateSearchResultsSectionProps {
  readonly items: readonly RoommateSummaryCardViewModel[];
  readonly canLoadMore: boolean;
  readonly isLoadingMore?: boolean;
  readonly updating?: boolean;
  readonly onLoadMore: () => void;
  readonly onOpenDetail?: (item: RoommateSummaryCardViewModel) => void;
  readonly onStartChat?: (item: RoommateSummaryCardViewModel) => void;
  readonly onBookmarkToggle?: (targetUserId: string, bookmarked: boolean) => void;
}

export function RoommateSearchResultsSection({
  items,
  canLoadMore,
  isLoadingMore = false,
  updating = false,
  onLoadMore,
  onOpenDetail,
  onStartChat,
  onBookmarkToggle,
}: RoommateSearchResultsSectionProps) {
  return (
    <section
      className="relative min-w-0 space-y-3 overflow-x-clip"
      aria-label="룸메이트 검색 결과"
      aria-busy={updating || undefined}
    >
      {updating ? (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
        >
          결과 업데이트 중
        </p>
      ) : null}
      <ul
        className={`grid min-w-0 gap-3 transition-opacity ${
          updating ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {items.map((item) => (
          <li key={item.id}>
            <RoommateSummaryCard
              item={item}
              detailAction={
                onOpenDetail ? buildDetailAction(item, () => onOpenDetail(item)) : undefined
              }
              onStartChat={onStartChat}
              onBookmarkToggle={onBookmarkToggle}
            />
          </li>
        ))}
      </ul>

      {canLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full rounded-2xl border-2 border-(--knu-border) bg-white py-3 text-sm font-semibold text-(--knu-primary) transition-all hover:border-(--knu-primary) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingMore ? '불러오는 중' : '더 보기'}
        </button>
      ) : (
        <p className="py-4 text-center text-sm text-(--knu-text-tertiary)">
          {items.length}명의 룸메이트
        </p>
      )}
    </section>
  );
}

function buildDetailAction(item: RoommateSummaryCardViewModel, onOpen: () => void) {
  const enabled = item.detailViewable && item.detailEntryToken !== null;
  if (!enabled) return undefined;

  return {
    enabled,
    label: '프로필 열람하기',
    accessibilityLabel: `${item.nickname} 프로필 열람하기`,
    onOpen,
  };
}
