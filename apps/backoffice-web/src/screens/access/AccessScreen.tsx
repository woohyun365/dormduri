'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type {
  AccessRequest,
  AccountListResponse,
  BackofficeRole,
  PageCursor,
  RoleCatalogResponse,
} from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { errorMessage } from '@/ui/error-messages';
import { formatKst, shortId } from '@/ui/format';
import { Button, FormMessage, Section, SecondaryButton, TextAreaField } from '@/ui/forms';
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS, ROLE_LABELS } from '@/ui/labels';

type Accounts = AccountListResponse['accounts'];
type Message = { readonly tone: 'error' | 'success'; readonly text: string } | null;

const STATUS_FILTERS: readonly { status: AccessRequest['status'] | null; label: string }[] = [
  { status: 'PENDING', label: '대기' },
  { status: null, label: '전체' },
  { status: 'APPROVED', label: '승인' },
  { status: 'REJECTED', label: '거절' },
  { status: 'EXPIRED', label: '만료' },
];

function accountName(accounts: Accounts | null, id: string | null): string {
  if (!id) return '—';
  const account = accounts?.find((candidate) => candidate.id === id);
  return account ? account.displayName : shortId(id);
}

/**
 * Role grant and revoke requests (OA-R9). The decider differs from the requester; only when the
 * requester is the one active approver may they approve their own request, with a reason (the API
 * counts approvers at decision time and refuses otherwise).
 */
export function AccessScreen({
  requests,
  roles,
  accounts,
  selfAccountId,
  canRequest,
  canApprove,
  status,
  nextPage,
}: {
  readonly requests: readonly AccessRequest[];
  readonly roles: RoleCatalogResponse['roles'];
  readonly accounts: Accounts | null;
  readonly selfAccountId: string;
  readonly canRequest: boolean;
  readonly canApprove: boolean;
  readonly status: AccessRequest['status'] | null;
  readonly nextPage: PageCursor | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function run(action: () => ReturnType<typeof postBff>, success: string) {
    setPending(true);
    setMessage(null);
    const result = await withReauthentication(action);
    setPending(false);
    setMessage(
      result.ok
        ? { tone: 'success', text: success }
        : { tone: 'error', text: errorMessage(result.code) },
    );
    if (result.ok) router.refresh();
    return result.ok;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const reason = String(form.get('reason') ?? '').trim();
    const ok = await run(
      () =>
        postBff('/api/access/requests', {
          kind: String(form.get('kind')),
          targetAccountId: String(form.get('targetAccountId') ?? '').trim(),
          targetRole: String(form.get('targetRole')),
          ...(reason ? { reason } : {}),
        }),
      '권한 요청을 만들었습니다. 다른 승인 권한 운영자가 결정합니다.',
    );
    if (ok) formElement.reset();
  }

  return (
    <>
      <h1 className="text-title-1 font-semibold text-fg-neutral">권한 요청</h1>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {canRequest ? (
        <Section id="access-create" title="새 요청">
          <form
            onSubmit={(event) => void create(event)}
            className="grid gap-3 sm:grid-cols-3"
            aria-label="권한 요청 만들기"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="request-kind" className="text-body font-medium text-fg-label">
                종류
              </label>
              <select
                id="request-kind"
                name="kind"
                className="rounded-control border border-stroke-neutral px-3 py-2 text-body"
              >
                <option value="ROLE_GRANT">{REQUEST_KIND_LABELS.ROLE_GRANT}</option>
                <option value="ROLE_REVOKE">{REQUEST_KIND_LABELS.ROLE_REVOKE}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="request-target" className="text-body font-medium text-fg-label">
                대상 운영자
              </label>
              {accounts ? (
                <select
                  id="request-target"
                  name="targetAccountId"
                  required
                  className="rounded-control border border-stroke-neutral px-3 py-2 text-body"
                >
                  {accounts
                    .filter((account) => account.status === 'ACTIVE')
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName} ({account.email})
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  id="request-target"
                  name="targetAccountId"
                  required
                  placeholder="계정 id"
                  className="rounded-control border border-stroke-neutral px-3 py-2 text-body"
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="request-role" className="text-body font-medium text-fg-label">
                역할
              </label>
              <select
                id="request-role"
                name="targetRole"
                className="rounded-control border border-stroke-neutral px-3 py-2 text-body"
              >
                {roles.map(({ role }) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role as BackofficeRole]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <TextAreaField
                id="request-reason"
                name="reason"
                label="사유(선택)"
                hint="업무 사유만 적고 사용자 개인정보는 쓰지 마세요. 요청 전에 passkey로 다시 확인합니다."
                maxLength={500}
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={pending}>
                요청 만들기
              </Button>
            </div>
          </form>
        </Section>
      ) : null}

      <Section id="access-list" title="요청 목록">
        <nav aria-label="요청 상태">
          <ul className="flex flex-wrap gap-3 text-body">
            {STATUS_FILTERS.map((filter) => (
              <li key={filter.label}>
                <Link
                  href={{
                    pathname: '/access',
                    query: filter.status ? { status: filter.status } : {},
                  }}
                  prefetch={false}
                  aria-current={filter.status === status ? 'page' : undefined}
                  className="underline-offset-4 hover:underline aria-current-page:font-semibold"
                >
                  {filter.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {requests.length === 0 ? (
          <p className="text-body text-fg-description">요청이 없습니다.</p>
        ) : null}
        <ul className="flex flex-col divide-y divide-stroke-row">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-2 py-3"
              aria-label={`요청 ${shortId(request.id)}`}
            >
              <p className="text-body text-fg-neutral">
                <strong>{REQUEST_KIND_LABELS[request.kind]}</strong> ·{' '}
                {accountName(accounts, request.targetAccountId)}에게{' '}
                {request.targetRole ? ROLE_LABELS[request.targetRole] : '—'} · 상태{' '}
                <strong>{REQUEST_STATUS_LABELS[request.status]}</strong>
                {request.selfApproved ? ' · 자기 승인' : ''}
              </p>
              <p className="text-caption text-fg-muted">
                요청자 {accountName(accounts, request.requestedByAccountId)} ·{' '}
                {formatKst(request.createdAt)} · 만료 {formatKst(request.expiresAt)}
                {request.decidedByAccountId
                  ? ` · 결정 ${accountName(accounts, request.decidedByAccountId)} ${formatKst(request.closedAt)}`
                  : ''}
              </p>
              {request.requestReason ? (
                <p className="text-caption text-fg-description">
                  요청 사유: {request.requestReason}
                </p>
              ) : null}
              {request.decisionReason ? (
                <p className="text-caption text-fg-description">
                  결정 사유: {request.decisionReason}
                </p>
              ) : null}
              {request.status === 'PENDING' ? (
                <PendingActions
                  request={request}
                  self={request.requestedByAccountId === selfAccountId}
                  canApprove={canApprove}
                  canCancel={canRequest && request.requestedByAccountId === selfAccountId}
                  pending={pending}
                  run={run}
                />
              ) : null}
            </li>
          ))}
        </ul>
        {nextPage ? (
          <Link
            href={{ pathname: '/access', query: { ...(status ? { status } : {}), ...nextPage } }}
            prefetch={false}
            className="text-body underline"
          >
            다음 요청 보기
          </Link>
        ) : null}
      </Section>
    </>
  );
}

function PendingActions({
  request,
  self,
  canApprove,
  canCancel,
  pending,
  run,
}: {
  readonly request: AccessRequest;
  readonly self: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly pending: boolean;
  readonly run: (action: () => ReturnType<typeof postBff>, success: string) => Promise<boolean>;
}) {
  const reasonId = `decision-reason-${request.id}`;
  const [missingReason, setMissingReason] = useState(false);

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
    void run(
      () =>
        postBff(`/api/access/requests/${request.id}/${approve ? 'approve' : 'reject'}`, {
          // The approver sends the digest of what this screen showed; a changed request fails.
          contentDigest: request.contentDigest,
          ...(reason ? { reason } : {}),
        }),
      approve ? '요청을 승인했습니다.' : '요청을 거절했습니다.',
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {canApprove ? (
        <form
          onSubmit={decide}
          className="flex flex-col gap-2"
          aria-label={`요청 ${shortId(request.id)} 결정`}
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
          {missingReason ? <FormMessage tone="error">거절 사유를 적으세요.</FormMessage> : null}
          <div className="flex gap-2">
            <Button type="submit" value="approve" disabled={pending}>
              승인
            </Button>
            {self ? null : (
              <SecondaryButton type="submit" value="reject" disabled={pending}>
                거절
              </SecondaryButton>
            )}
          </div>
        </form>
      ) : null}
      {canCancel ? (
        <SecondaryButton
          disabled={pending}
          onClick={() =>
            void run(
              () => postBff(`/api/access/requests/${request.id}/cancel`),
              '요청을 취소했습니다.',
            )
          }
        >
          요청 취소
        </SecondaryButton>
      ) : null}
    </div>
  );
}
