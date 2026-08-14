import { CheckCircle, ChevronDown, Clock3, History, RotateCcw, XCircle } from 'lucide-react';

export type MatchingActivityResult =
  | 'REQUEST_REJECTED'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_EXPIRED'
  | 'MATCHED_SUCCESS'
  | 'UNMATCHED_AFTER_SUCCESS';

export type MatchingActivityAutoClosedCause =
  | 'VIEWER_MATCHED'
  | 'COUNTERPART_MATCHED'
  | 'PARTICIPATION_CANCELLED'
  | 'PRECONDITION_FAILED';

export interface MatchingActivityLedgerEntry {
  readonly id: string;
  readonly result: MatchingActivityResult;
  readonly title: string;
  readonly detail: string;
  readonly dateLabel?: string;
}

export interface MatchingActivityLedgerGroupedEntry {
  readonly id: string;
  readonly nickname: string;
  readonly directionLabel: string;
}

export type MatchingActivityLedgerItem =
  | {
      readonly id: string;
      readonly kind: 'entry';
      readonly entry: MatchingActivityLedgerEntry;
    }
  | {
      readonly id: string;
      readonly kind: 'auto-closed-group';
      readonly cause: MatchingActivityAutoClosedCause;
      readonly dateLabel?: string;
      readonly entries: readonly MatchingActivityLedgerGroupedEntry[];
    };

export function MatchingActivityLedger({
  items,
  ariaLabel,
}: {
  readonly items: readonly MatchingActivityLedgerItem[];
  readonly ariaLabel: string;
}) {
  return (
    <ul aria-label={ariaLabel} className="grid gap-2">
      {items.map((item) => (
        <MatchingActivityItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

function MatchingActivityItem({ item }: { readonly item: MatchingActivityLedgerItem }) {
  if (item.kind === 'auto-closed-group') {
    return (
      <li>
        <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--knu-primary) [&::-webkit-details-marker]:hidden">
            <MatchingActivityCardContent
              result="REQUEST_CANCELLED"
              title={`요청 ${item.entries.length}건 자동 종료`}
              detail={autoClosedGroupDetail(item.cause)}
              dateLabel={item.dateLabel}
              disclosure
            />
          </summary>
          <ul className="grid gap-1.5 border-t border-slate-100 bg-slate-50 p-2">
            {item.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs"
              >
                <MatchingActivityCardContent
                  result="REQUEST_CANCELLED"
                  title={entry.nickname}
                  detail={`${entry.directionLabel} · 자동 종료`}
                />
              </li>
            ))}
          </ul>
        </details>
      </li>
    );
  }

  return (
    <li className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
      <MatchingActivityCardContent {...item.entry} />
    </li>
  );
}

function MatchingActivityCardContent({
  result,
  title,
  detail,
  dateLabel,
  disclosure = false,
}: Omit<MatchingActivityLedgerEntry, 'id'> & { readonly disclosure?: boolean }) {
  return (
    <>
      <MatchingActivityIcon result={result} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black leading-4 text-(--knu-text-primary)">
          {title}
        </span>
        <span className="mt-0.5 block break-keep text-[11px] leading-4 text-(--knu-text-tertiary)">
          {detail}
        </span>
      </span>
      {dateLabel ? (
        <span className="flex shrink-0 flex-col items-end gap-1 text-right">
          <time className="whitespace-nowrap text-[11px] font-medium leading-4 text-(--knu-text-tertiary)">
            {dateLabel}
          </time>
          {disclosure ? (
            <ChevronDown
              className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180"
              aria-hidden
            />
          ) : null}
        </span>
      ) : null}
    </>
  );
}

function MatchingActivityIcon({ result }: { readonly result: MatchingActivityResult }) {
  const presentation = {
    REQUEST_REJECTED: {
      icon: <XCircle className="h-4 w-4" aria-hidden />,
      className: 'bg-rose-100 text-rose-700',
    },
    REQUEST_CANCELLED: {
      icon: <RotateCcw className="h-4 w-4" aria-hidden />,
      className: 'bg-blue-100 text-blue-700',
    },
    REQUEST_EXPIRED: {
      icon: <Clock3 className="h-4 w-4" aria-hidden />,
      className: 'bg-slate-200 text-slate-700',
    },
    MATCHED_SUCCESS: {
      icon: <CheckCircle className="h-4 w-4" aria-hidden />,
      className: 'bg-emerald-100 text-emerald-700',
    },
    UNMATCHED_AFTER_SUCCESS: {
      icon: <History className="h-4 w-4" aria-hidden />,
      className: 'bg-violet-100 text-violet-700',
    },
  }[result];

  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${presentation.className}`}
    >
      {presentation.icon}
    </span>
  );
}

function autoClosedGroupDetail(cause: MatchingActivityAutoClosedCause) {
  switch (cause) {
    case 'VIEWER_MATCHED':
      return '내 매칭 확정으로 정리됐어요.';
    case 'COUNTERPART_MATCHED':
      return '상대 매칭 확정으로 정리됐어요.';
    case 'PARTICIPATION_CANCELLED':
      return '시즌 참여 취소 요청이 종료됐어요.';
    case 'PRECONDITION_FAILED':
      return '매칭 참여 조건이 충족되지 않아 요청이 종료됐어요.';
  }
}
