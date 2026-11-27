import type { AccessRequest, AccountListResponse, PageCursor } from '@repo/shared/backoffice';
import { EmptyState } from '@/ui/EmptyState';
import { formatKstShort } from '@/ui/format';
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS, ROLE_LABELS } from '@/ui/labels';
import { REQUEST_STATUS_MEANING, StatusBadge } from '@/ui/status';
import { StatusFilter } from '@/ui/StatusFilter';
import { TextLink } from '@/ui/TextLink';
import { accountName } from '@/ui/account-name';

const STATUS_FILTERS: readonly { status: AccessRequest['status'] | null; label: string }[] = [
  { status: 'PENDING', label: '대기' },
  { status: null, label: '전체' },
  { status: 'APPROVED', label: '승인' },
  { status: 'REJECTED', label: '거절' },
  { status: 'EXPIRED', label: '만료' },
];

/**
 * The master list of the access requests: the status filter is the URL query, a request is chosen with its button (the
 * choice is screen state), and the next page keeps the keyset link of the API.
 */
export function RequestList({
  requests,
  accounts,
  selfAccountId,
  status,
  nextPage,
  selectedId,
  onSelect,
}: {
  readonly requests: readonly AccessRequest[];
  readonly accounts: AccountListResponse['accounts'] | null;
  readonly selfAccountId: string;
  readonly status: AccessRequest['status'] | null;
  readonly nextPage: PageCursor | null;
  readonly selectedId: string | null;
  readonly onSelect: (requestId: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <StatusFilter
        label="요청 상태"
        items={STATUS_FILTERS.map((filter) => ({
          key: filter.label,
          label: filter.label,
          href: { pathname: '/access', query: filter.status ? { status: filter.status } : {} },
          current: filter.status === status,
        }))}
      />
      {requests.length === 0 ? (
        // An empty list and an empty filter result read apart (design guide ⑥).
        status ? (
          <EmptyState
            icon="access"
            title={`${STATUS_FILTERS.find((filter) => filter.status === status)?.label ?? ''} 상태의 요청이 없습니다.`}
            action={
              <TextLink href="/access" className="text-body">
                전체 요청 보기
              </TextLink>
            }
          />
        ) : (
          <EmptyState icon="access" title="요청이 없습니다." />
        )
      ) : (
        <ul aria-label="요청 목록" className="flex flex-col gap-2">
          {requests.map((request) => {
            const isSelected = request.id === selectedId;
            const mine = request.requestedByAccountId === selfAccountId;
            return (
              <li key={request.id}>
                <button
                  type="button"
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => onSelect(request.id)}
                  className={`flex w-full flex-col gap-1.5 rounded-card border px-4 py-3 text-left ${
                    isSelected
                      ? 'border-stroke-selected bg-layer-selected'
                      : 'border-stroke-subtle bg-layer-default hover:bg-layer-muted'
                  } focus-ring`}
                >
                  {/* The status sits at the head's end, apart from the kind (design guide ⑥). */}
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-label font-semibold text-fg-label">
                        {REQUEST_KIND_LABELS[request.kind]}
                      </span>
                      {mine ? <span className="text-caption text-fg-muted">· 내 요청</span> : null}
                    </span>
                    <StatusBadge meaning={REQUEST_STATUS_MEANING[request.status]}>
                      {REQUEST_STATUS_LABELS[request.status]}
                    </StatusBadge>
                  </span>
                  <span className="text-body font-semibold text-fg-neutral">
                    {accountName(accounts, request.targetAccountId)} ·{' '}
                    {request.targetRole ? ROLE_LABELS[request.targetRole] : '—'}
                  </span>
                  <span className="text-caption text-fg-muted tabular-nums">
                    요청자 {accountName(accounts, request.requestedByAccountId)} ·{' '}
                    {formatKstShort(request.createdAt)} KST
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {nextPage ? (
        <TextLink
          href={{ pathname: '/access', query: { ...(status ? { status } : {}), ...nextPage } }}
          className="self-start text-body"
        >
          다음 요청 보기
        </TextLink>
      ) : null}
    </div>
  );
}
