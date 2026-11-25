'use client';

import { useState, type FormEvent, type Ref } from 'react';
import type { AccessRequest, AccountListResponse } from '@repo/shared/backoffice';
import { Button } from '@/ui/Button';
import { TextAreaField } from '@/ui/fields';
import { formatKstDetail, shortId } from '@/ui/format';
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS, ROLE_LABELS } from '@/ui/labels';
import { Notice } from '@/ui/Notice';
import { failureText, type ResultMessage } from '@/ui/result-message';
import { REQUEST_STATUS_MEANING, StatusBadge } from '@/ui/status';
import { accountName } from './account-name';

/**
 * The detail of the chosen request, with its fixed decision area under it while it waits (design guide ④
 * master-detail). The decider differs from the requester; only when the requester is the one active approver may they
 * approve their own request, with a reason (the API counts approvers at decision time and refuses otherwise). A
 * decided request shows who decided, when, and why.
 */
export function RequestDetail({
  request,
  accounts,
  self,
  canApprove,
  canCancel,
  pending,
  failure,
  onDecide,
  onCancel,
  headingRef,
}: {
  readonly request: AccessRequest;
  readonly accounts: AccountListResponse['accounts'] | null;
  /** The viewer made this request. */
  readonly self: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly pending: boolean;
  /** The failure of the last decision or cancel, shown in the decision area. */
  readonly failure: ResultMessage | null;
  readonly onDecide: (approve: boolean, reason: string) => void;
  readonly onCancel: () => void;
  /** The heading the screen moves focus to where the detail sits under the list. */
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const [missingReason, setMissingReason] = useState(false);
  const reasonId = `decision-reason-${request.id}`;
  const rows: [string, string][] = [
    ['대상 운영자', accountName(accounts, request.targetAccountId)],
    ['역할', request.targetRole ? ROLE_LABELS[request.targetRole] : '—'],
    ['요청자', accountName(accounts, request.requestedByAccountId)],
    ['요청 시각', formatKstDetail(request.createdAt)],
    ['만료', formatKstDetail(request.expiresAt)],
    ['요청 사유', request.requestReason ?? '—'],
  ];
  if (request.decidedByAccountId) {
    rows.push(
      ['결정자', accountName(accounts, request.decidedByAccountId)],
      ['결정 시각', formatKstDetail(request.closedAt)],
    );
  }
  if (request.decisionReason) rows.push(['결정 사유', request.decisionReason]);
  const shown = missingReason ? failureText('거절 사유를 적으세요.') : failure;

  function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    const approve = submitter?.value !== 'reject';
    if (!approve && !reason) {
      setMissingReason(true);
      return;
    }
    setMissingReason(false);
    onDecide(approve, reason);
  }

  // In the decision row the cancel sits at the row's end; alone it starts the area.
  const cancel = (className: string) =>
    canCancel ? (
      <Button tone="secondary" disabled={pending} onClick={onCancel} className={className}>
        요청 취소
      </Button>
    ) : null;

  return (
    <section
      aria-labelledby="access-detail-heading"
      className="flex min-w-0 flex-col rounded-card border border-stroke-subtle bg-layer-default lg:sticky lg:top-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke-subtle px-card py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption text-fg-muted">요청 {shortId(request.id)}</p>
          <h2
            ref={headingRef}
            id="access-detail-heading"
            tabIndex={-1}
            className="rounded-control text-title-2 font-semibold text-fg-neutral focus-ring"
          >
            {REQUEST_KIND_LABELS[request.kind]} · {accountName(accounts, request.targetAccountId)}
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
      {request.status === 'PENDING' && (canApprove || canCancel) ? (
        <div className="flex flex-col gap-3 border-t border-stroke-subtle bg-layer-muted px-card py-4">
          {canApprove ? (
            <form
              aria-label={`요청 ${shortId(request.id)} 결정`}
              className="flex flex-col gap-3"
              onSubmit={decide}
            >
              <TextAreaField
                id={reasonId}
                name="reason"
                label={self ? '자기 승인 사유(필수)' : '결정 사유(거절할 때 필수)'}
                hint={
                  self
                    ? '승인 권한을 가진 운영자가 나 하나뿐일 때만 내 요청을 승인할 수 있습니다. 자기 승인은 감사에 표시되고 경보가 갑니다.'
                    : '사용자 개인정보는 쓰지 마세요. 결정 전에 passkey로 다시 확인합니다.'
                }
                required={self}
                maxLength={500}
              />
              {shown ? (
                <Notice tone={shown.tone} role={shown.role}>
                  {shown.text}
                </Notice>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" value="approve" disabled={pending}>
                  승인
                </Button>
                {self ? null : (
                  <Button type="submit" value="reject" tone="danger" disabled={pending}>
                    거절
                  </Button>
                )}
                {cancel('ml-auto')}
              </div>
            </form>
          ) : (
            <>
              {shown ? (
                <Notice tone={shown.tone} role={shown.role}>
                  {shown.text}
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
