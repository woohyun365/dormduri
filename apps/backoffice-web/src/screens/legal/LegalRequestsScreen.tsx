'use client';

import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type Ref } from 'react';
import type {
  AccountListResponse,
  LegalDecisionCheck,
  LegalRequest,
  PageCursor,
} from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { accountName } from '@/ui/account-name';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DecisionForm } from '@/ui/DecisionForm';
import { EmptyState } from '@/ui/EmptyState';
import { formatKstDetail, formatKstShort, shortId } from '@/ui/format';
import {
  LEGAL_KIND_LABELS,
  LEGAL_NOTICE_CLASS_LABELS,
  LEGAL_REFUSAL_LABELS,
  LEGAL_REQUEST_KIND_LABELS,
  REQUEST_STATUS_LABELS,
} from '@/ui/labels';
import { Notice } from '@/ui/Notice';
import { PageHeader } from '@/ui/PageHeader';
import { success, useFailure, type ResultMessage } from '@/ui/result-message';
import { REQUEST_STATUS_MEANING, StatusBadge } from '@/ui/status';
import { StatusFilter } from '@/ui/StatusFilter';
import { TextLink } from '@/ui/TextLink';
import type { LegalRequestDetail } from './legal-types';
import { ComparisonTable, LegalDocumentView } from './LegalSections';

type Accounts = AccountListResponse['accounts'];
type Status = LegalRequest['status'];

/** Below 1024px the detail sits under the list (design guide ④): a choice moves there. */
const NARROW = '(width < 64rem)';

const STATUS_FILTERS: readonly { status: Status | null; label: string }[] = [
  { status: 'PENDING', label: '대기' },
  { status: null, label: '전체' },
  { status: 'APPROVED', label: '승인' },
  { status: 'REJECTED', label: '거절' },
  { status: 'EXPIRED', label: '만료' },
];

function requestsHref(status: Status | null, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...extra });
  const text = query.toString();
  return text ? `/legal/requests?${text}` : '/legal/requests';
}

/** What the request names, as the detail shows it: the draft's content or the version. */
function target(detail: LegalRequestDetail) {
  if (detail.draft) {
    const { content } = detail.draft;
    return {
      kind: content.kind,
      title: content.title,
      summaryItems: content.summaryItems,
      sections: content.sections,
      changeSummary: content.changeSummary,
      noticeClass: content.noticeClass,
      consentRequired: content.consentRequired,
      effectiveDate: content.proposedEffectiveDate,
      appliesUntil: content.appliesUntil,
    };
  }
  if (detail.version) {
    const { version } = detail;
    return {
      kind: version.kind,
      title: version.title,
      summaryItems: version.summaryItems,
      sections: version.sections,
      changeSummary: version.changeSummary,
      noticeClass: version.noticeClass,
      consentRequired: version.consentRequired,
      effectiveDate: version.effectiveDate,
      appliesUntil: version.appliesUntil,
    };
  }
  return null;
}

function CheckLine({ check }: { readonly check: LegalDecisionCheck | null }) {
  if (check === null) {
    return (
      <Notice tone="info" role="status">
        닫힌 요청입니다. 대상은 지금 상태로 보입니다.
      </Notice>
    );
  }
  if (check.ok) {
    return (
      <p className="text-body text-fg-description">
        지금 기준 검사를 통과합니다. 승인할 때 같은 검사를 다시 합니다.
      </p>
    );
  }
  return (
    <Notice tone="warning" role="status">
      지금 검사로는 승인할 수 없습니다. {LEGAL_REFUSAL_LABELS[check.reason]}
    </Notice>
  );
}

/**
 * The chosen request (design guide ④ master-detail): what it names — the summary items, the notice class, the date,
 * the reconsent mark — the comparison with the version before it (or the whole text where none comes before), the
 * checks as of now and, while it waits, the decision area. Approve opens only after the approver marks that they read
 * the comparison or the text with the class and the date, and while the checks do not refuse.
 */
function RequestDetail({
  detail,
  accounts,
  selfAccountId,
  canApprove,
  canCancel,
  pending,
  failure,
  onDecide,
  onCancel,
  headingRef,
}: {
  readonly detail: LegalRequestDetail;
  readonly accounts: Accounts | null;
  readonly selfAccountId: string;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly pending: boolean;
  readonly failure: ResultMessage | null;
  readonly onDecide: (approve: boolean, reason: string) => void;
  readonly onCancel: () => void;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { request, previousVersion, comparison, check } = detail;
  const [read, setRead] = useState(false);
  const shown = target(detail);
  const self = request.requestedByAccountId === selfAccountId;
  const markLabel = previousVersion
    ? '대조표와 고지 등급·시행일을 확인했습니다'
    : '본문 전체와 고지 등급·시행일을 확인했습니다';
  const rows: [string, string][] = [];
  if (shown) {
    rows.push(['고지 등급', LEGAL_NOTICE_CLASS_LABELS[shown.noticeClass]]);
    rows.push(
      shown.noticeClass === 'HISTORICAL'
        ? ['적용 기간', `${shown.effectiveDate} ~ ${shown.appliesUntil ?? '—'}`]
        : ['시행일', shown.effectiveDate],
    );
    rows.push(['재동의', shown.consentRequired ? '필요' : '필요 없음']);
  }
  rows.push(
    [
      '바로 앞 판',
      previousVersion ? `${previousVersion.effectiveDate} 시행(${previousVersion.title})` : '없음',
    ],
    ['요청자', accountName(accounts, request.requestedByAccountId)],
    ['요청 시각', formatKstDetail(request.createdAt)],
    ['만료', formatKstDetail(request.expiresAt)],
    ['요청 사유', request.requestReason ?? '—'],
  );
  if (request.decidedByAccountId) {
    rows.push(
      ['결정자', accountName(accounts, request.decidedByAccountId)],
      ['결정 시각', formatKstDetail(request.closedAt)],
    );
  }
  if (request.decisionReason) rows.push(['결정 사유', request.decisionReason]);
  const cancel = (className: string) =>
    canCancel && self ? (
      <Button tone="secondary" disabled={pending} onClick={onCancel} className={className}>
        요청 취소
      </Button>
    ) : null;
  const waiting = request.status === 'PENDING';

  return (
    <section
      aria-labelledby="legal-request-heading"
      className="flex min-w-0 flex-col rounded-card border border-stroke-subtle bg-layer-default"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke-subtle px-card py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption text-fg-muted">요청 {shortId(request.id)}</p>
          <h2
            ref={headingRef}
            id="legal-request-heading"
            tabIndex={-1}
            className="rounded-control text-title-2 font-semibold text-fg-neutral focus-ring"
          >
            {LEGAL_REQUEST_KIND_LABELS[request.kind]} ·{' '}
            {shown ? LEGAL_KIND_LABELS[shown.kind] : '대상 없음'}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge meaning={REQUEST_STATUS_MEANING[request.status]}>
            {REQUEST_STATUS_LABELS[request.status]}
          </StatusBadge>
          {request.selfApproved ? <StatusBadge meaning="warning">자기 승인</StatusBadge> : null}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-3 px-card py-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
            <dd className="text-body text-fg-neutral tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {shown ? (
        <div className="flex flex-col gap-4 border-t border-stroke-subtle px-card py-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-label font-semibold text-fg-label">변경 요약</h3>
            <p className="text-body text-fg-neutral">{shown.changeSummary}</p>
          </div>
          <CheckLine check={check} />
          <h3 className="text-label font-semibold text-fg-label">
            {previousVersion ? '조항 대조표' : '본문 전체'}
          </h3>
          {previousVersion ? (
            <>
              <ComparisonTable articles={comparison} />
              <details className="rounded-card border border-stroke-subtle p-4">
                <summary className="cursor-pointer rounded-control text-body font-semibold text-fg-brand focus-ring">
                  본문 전체 보기
                </summary>
                <div className="pt-4">
                  <LegalDocumentView
                    label="본문 전체"
                    title={shown.title}
                    summaryItems={shown.summaryItems}
                    sections={shown.sections}
                  />
                </div>
              </details>
            </>
          ) : (
            <>
              <p className="text-body text-fg-description">
                앞 판이 없어 대조표가 없습니다. 이전 판 기록과 첫 게시는 본문 전체를 확인합니다.
              </p>
              <LegalDocumentView
                label="본문 전체"
                title={shown.title}
                summaryItems={shown.summaryItems}
                sections={shown.sections}
              />
            </>
          )}
        </div>
      ) : null}
      {waiting && (canApprove || (canCancel && self)) ? (
        <div className="flex flex-col gap-3 border-t border-stroke-subtle bg-layer-muted px-card py-4">
          {canApprove ? (
            <DecisionForm
              label={`요청 ${shortId(request.id)} 결정`}
              reasonId={`legal-decision-reason-${request.id}`}
              self={self}
              pending={pending}
              failure={failure}
              approveBlocked={!read || check?.ok === false}
              before={
                <label className="flex items-start gap-2 text-body text-fg-label">
                  <input
                    type="checkbox"
                    checked={read}
                    onChange={(event) => setRead(event.target.checked)}
                    className="mt-1 size-4 focus-ring"
                  />
                  {markLabel}
                </label>
              }
              cancel={cancel('ml-auto')}
              onDecide={onDecide}
            />
          ) : (
            <>
              {failure ? (
                <Notice tone={failure.tone} role={failure.role}>
                  {failure.text}
                </Notice>
              ) : null}
              {cancel('self-start')}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function RequestList({
  requests,
  accounts,
  selfAccountId,
  status,
  nextPage,
  selectedId,
  onSelect,
}: {
  readonly requests: readonly LegalRequest[];
  readonly accounts: Accounts | null;
  readonly selfAccountId: string;
  readonly status: Status | null;
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
          href: requestsHref(filter.status) as Route,
          current: filter.status === status,
        }))}
      />
      {requests.length === 0 ? (
        status ? (
          <EmptyState
            icon="approval"
            title={`${STATUS_FILTERS.find((filter) => filter.status === status)?.label ?? ''} 상태의 요청이 없습니다.`}
            action={
              <TextLink href="/legal/requests" className="text-body">
                전체 요청 보기
              </TextLink>
            }
          />
        ) : (
          <EmptyState icon="approval" title="법적 문서 요청이 없습니다.">
            초안에서 게시 승인을 요청하거나 시행 예정 판에서 철회를 요청하면 여기에 보입니다.
          </EmptyState>
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
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-label font-semibold text-fg-label">
                        {LEGAL_REQUEST_KIND_LABELS[request.kind]}
                      </span>
                      {mine ? <span className="text-caption text-fg-muted">· 내 요청</span> : null}
                    </span>
                    <StatusBadge meaning={REQUEST_STATUS_MEANING[request.status]}>
                      {REQUEST_STATUS_LABELS[request.status]}
                    </StatusBadge>
                  </span>
                  <span className="text-body font-semibold text-fg-neutral tabular-nums">
                    요청 {shortId(request.id)}
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
          href={requestsHref(status, { ...nextPage }) as Route}
          className="self-start text-body"
        >
          다음 요청 보기
        </TextLink>
      ) : null}
    </div>
  );
}

/**
 * Legal publish and withdraw requests as a master-detail (design guide ④): the status filter is the URL query and, as
 * the detail is a read of its own (comparison, checks), so is the chosen request (`request`); a choice changes only
 * that query and the server reads the one detail. A decision or a cancel keeps the choice and refreshes (no automatic
 * next request); another status filter starts from its first request.
 */
export function LegalRequestsScreen({
  requests,
  selected,
  accounts,
  selfAccountId,
  canEdit,
  canApprove,
  status,
  nextPage,
}: {
  readonly requests: readonly LegalRequest[];
  readonly selected: LegalRequestDetail | null;
  readonly accounts: Accounts | null;
  readonly selfAccountId: string;
  readonly canEdit: boolean;
  readonly canApprove: boolean;
  readonly status: Status | null;
  readonly nextPage: PageCursor | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The decided request stays chosen (design guide ④, no auto next): with its id in the query the page reads it again
  // even when the status filter no longer lists it.
  function keepChosen(requestId: string) {
    if (searchParams.get('request') === requestId) router.refresh();
    else router.replace(requestsHref(status, { request: requestId }) as Route, { scroll: false });
  }
  const failure = useFailure();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [decisionFailure, setDecisionFailure] = useState<ResultMessage | null>(null);
  const selectedKey = selected?.request.id ?? null;
  const [shownKey, setShownKey] = useState(selectedKey);
  if (shownKey !== selectedKey) {
    setShownKey(selectedKey);
    setDecisionFailure(null);
  }
  const [shownStatus, setShownStatus] = useState(status);
  if (shownStatus !== status) {
    setShownStatus(status);
    setMessage(null);
  }
  const toDetail = useRef(false);
  const detailRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!toDetail.current) return;
    toDetail.current = false;
    if (window.matchMedia?.(NARROW).matches) detailRef.current?.focus();
  }, [selectedKey]);
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;

  async function decide(request: LegalRequest, approve: boolean, reason: string) {
    setPending(true);
    setMessage(null);
    setDecisionFailure(null);
    const result = await withReauthentication(() =>
      postBff(`/api/legal/requests/${request.id}/${approve ? 'approve' : 'reject'}`, {
        // The approver sends the digest of what this screen showed; a changed draft or version fails.
        contentDigest: request.contentDigest,
        ...(reason ? { reason } : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setDecisionFailure(failure(result.code));
      return;
    }
    setMessage(success(approve ? '요청을 승인했습니다.' : '요청을 거절했습니다.'));
    keepChosen(request.id);
  }

  async function cancel(request: LegalRequest) {
    setPending(true);
    setMessage(null);
    setDecisionFailure(null);
    const result = await postBff(`/api/legal/requests/${request.id}/cancel`);
    setPending(false);
    if (!result.ok) {
      setDecisionFailure(failure(result.code));
      return;
    }
    setMessage(success('요청을 취소했습니다.'));
    keepChosen(request.id);
  }

  return (
    <>
      <PageHeader title="게시 요청" meta={`이 목록의 대기 ${pendingCount}건`} />
      {message ? (
        <Notice tone={message.tone} role={message.role}>
          {message.text}
        </Notice>
      ) : null}
      <div
        className={`grid items-start gap-stack ${requests.length || selected ? 'lg:grid-cols-master-detail' : ''}`}
      >
        <RequestList
          requests={requests}
          accounts={accounts}
          selfAccountId={selfAccountId}
          status={status}
          nextPage={nextPage}
          selectedId={selectedKey}
          onSelect={(requestId) => {
            if (requestId === selectedKey) return;
            toDetail.current = true;
            router.push(requestsHref(status, { request: requestId }) as Route, { scroll: false });
          }}
        />
        {selected ? (
          <RequestDetail
            key={selected.request.id}
            headingRef={detailRef}
            detail={selected}
            accounts={accounts}
            selfAccountId={selfAccountId}
            canApprove={canApprove}
            canCancel={canEdit}
            pending={pending}
            failure={decisionFailure}
            onDecide={(approve, reason) => void decide(selected.request, approve, reason)}
            onCancel={() => void cancel(selected.request)}
          />
        ) : requests.length ? (
          <Card id="legal-request-detail">
            <p className="text-body text-fg-description">왼쪽 목록에서 요청을 고르세요.</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
