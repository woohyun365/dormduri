import { History, ListChecks } from 'lucide-react';
import {
  MatchingActivityLedger,
  type MatchingActivityLedgerItem,
} from '../../components/pair/MatchingActivityLedger';
import type { CurrentMatchActivityItemView } from '../../model/matching-current-activity-view';

export function CurrentMatchActivitySection({
  items,
}: {
  readonly items: readonly CurrentMatchActivityItemView[];
}) {
  return (
    <section aria-labelledby="matching-current-activity-heading" className="mt-6 min-w-0">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-5 w-1 rounded-full bg-violet-400" aria-hidden />
        <h2
          id="matching-current-activity-heading"
          className="flex items-center gap-2 text-lg font-bold text-(--knu-text-primary)"
        >
          <ListChecks className="h-4.5 w-4.5 text-violet-500" aria-hidden />
          활동 이력
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-(--knu-background-alt) text-(--knu-primary)">
            <History className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-(--knu-text-primary)">
            아직 활동 이력이 없어요.
          </p>
          <p className="mt-1 text-xs leading-5 text-(--knu-text-tertiary)">
            이번 시즌 나의 활동 기록을 확인할 수 있어요.
          </p>
        </div>
      ) : (
        <MatchingActivityLedger items={toLedgerItems(items)} ariaLabel="현재 시즌 매칭 활동" />
      )}
    </section>
  );
}

function toLedgerItems(
  items: readonly CurrentMatchActivityItemView[],
): readonly MatchingActivityLedgerItem[] {
  return items.map((item) =>
    item.kind === 'entry'
      ? {
          id: item.id,
          kind: 'entry',
          entry: {
            id: item.entry.id,
            result: item.entry.result,
            title: item.entry.title,
            detail: item.entry.detail,
            dateLabel: item.entry.dateLabel,
          },
        }
      : {
          id: item.id,
          kind: 'auto-closed-group',
          cause: item.cause,
          dateLabel: item.entries[0]?.dateLabel,
          entries: item.entries.map((entry) => ({
            id: entry.id,
            nickname: entry.nickname,
            directionLabel: entry.directionLabel,
          })),
        },
  );
}
