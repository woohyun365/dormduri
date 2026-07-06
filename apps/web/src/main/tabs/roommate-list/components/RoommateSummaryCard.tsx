import type { RoommateSummaryCardViewModel } from '../model/search/roommateSearchViewModel';

interface RoommateSummaryCardDetailAction {
  readonly enabled: boolean;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly onOpen: () => void;
}

interface RoommateSummaryCardProps {
  readonly item: RoommateSummaryCardViewModel;
  readonly detailAction?: RoommateSummaryCardDetailAction;
  readonly onBookmarkToggle?: (targetUserId: string, bookmarked: boolean) => void;
}

export function RoommateSummaryCard({
  item,
  detailAction,
  onBookmarkToggle,
}: RoommateSummaryCardProps) {
  const headingId = `roommate-summary-${item.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-3xl border border-[var(--knu-border)] bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-bold text-[var(--knu-text-primary)]">
            {item.nickname}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--knu-text-secondary)]">{item.intro}</p>
        </div>
        {item.scoreLabel ? (
          <span className="shrink-0 rounded-full bg-[var(--knu-primary-light)] px-3 py-1 text-xs font-bold text-[var(--knu-primary)]">
            {item.scoreLabel}
          </span>
        ) : null}
      </div>

      {item.facts.length > 0 ? (
        <dl className="mt-4 grid grid-cols-1 gap-2 text-xs text-[var(--knu-text-secondary)]">
          {item.facts.map((fact) => (
            <div
              key={`${item.id}-${fact.label}`}
              className="flex items-center justify-between rounded-2xl bg-[var(--knu-background-alt)] px-3 py-2"
            >
              <dt className="font-semibold text-[var(--knu-text-tertiary)]">{fact.label}</dt>
              <dd className="font-medium text-[var(--knu-text-secondary)]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2" aria-label="룸메이트 카드 상태">
        {item.summaryOnly ? (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[var(--knu-text-secondary)]">
            요약만 보기
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            상세 보기 가능
          </span>
        )}
        {item.resultReadLabel ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {item.resultReadLabel}
          </span>
        ) : null}
        {item.bookmarked ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            관심 목록에 있음
          </span>
        ) : null}
        <span className="rounded-full bg-[var(--knu-background-alt)] px-3 py-1 text-xs font-semibold text-[var(--knu-text-secondary)]">
          {item.actionStateLabel}
        </span>
      </div>

      {detailAction ? (
        <button
          type="button"
          aria-label={detailAction.accessibilityLabel}
          disabled={!detailAction.enabled}
          onClick={detailAction.onOpen}
          className="mt-4 w-full rounded-2xl bg-[var(--knu-primary)] py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--knu-primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--knu-background-alt)] disabled:text-[var(--knu-text-secondary)]"
        >
          {detailAction.label}
        </button>
      ) : null}

      {item.bookmarkAction ? (
        <button
          type="button"
          aria-label={item.bookmarkAction.accessibilityLabel}
          disabled={item.bookmarkAction.disabled}
          onClick={() => onBookmarkToggle?.(item.targetUserId, item.bookmarked)}
          className="mt-4 w-full rounded-2xl border-2 border-[var(--knu-border)] bg-white py-3 text-sm font-semibold text-[var(--knu-primary)] transition-all hover:border-[var(--knu-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.bookmarkAction.label}
        </button>
      ) : null}
    </article>
  );
}
