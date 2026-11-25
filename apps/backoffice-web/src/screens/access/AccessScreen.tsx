'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type {
  AccessRequest,
  AccountListResponse,
  PageCursor,
  RoleCatalogResponse,
} from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { PageHeader } from '@/ui/PageHeader';
import { success, useFailure, type ResultMessage } from '@/ui/result-message';
import { NewRequestDrawer } from './NewRequestDrawer';
import { RequestDetail } from './RequestDetail';
import { RequestList } from './RequestList';

type Accounts = AccountListResponse['accounts'];

/**
 * Role grant and revoke requests (OA-R9) as a master-detail (design guide ④): the status filter is the URL query, the
 * chosen request is screen state and stays after a decision (no automatic next request), and a new request opens in
 * a right drawer. Results of a decision show under the page title; a failure stays in the decision area or the drawer.
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
  const failure = useFailure();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);
  // A decided request stays chosen even when the refreshed list (a status filter) no longer holds it.
  const [decided, setDecided] = useState<AccessRequest | null>(null);
  const [decisionFailure, setDecisionFailure] = useState<ResultMessage | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newFailure, setNewFailure] = useState<ResultMessage | null>(null);
  const selected =
    requests.find((request) => request.id === selectedId) ??
    (decided && decided.id === selectedId ? decided : null) ??
    requests[0] ??
    null;
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;

  async function decide(request: AccessRequest, approve: boolean, reason: string) {
    setPending(true);
    setMessage(null);
    setDecisionFailure(null);
    const result = await withReauthentication(() =>
      postBff<AccessRequest>(
        `/api/access/requests/${request.id}/${approve ? 'approve' : 'reject'}`,
        {
          // The approver sends the digest of what this screen showed; a changed request fails.
          contentDigest: request.contentDigest,
          ...(reason ? { reason } : {}),
        },
      ),
    );
    setPending(false);
    if (!result.ok) {
      setDecisionFailure(failure(result.code));
      return;
    }
    // Revoking my own role ends my sessions in the same transaction (README §4), so a refresh would only find the
    // session gone; the login page says why instead.
    if (approve && request.kind === 'ROLE_REVOKE' && request.targetAccountId === selfAccountId) {
      router.replace('/login?ended=self-revoked');
      return;
    }
    setDecided(result.data);
    setMessage(success(approve ? '요청을 승인했습니다.' : '요청을 거절했습니다.'));
    router.refresh();
  }

  async function cancel(request: AccessRequest) {
    setPending(true);
    setMessage(null);
    setDecisionFailure(null);
    const result = await withReauthentication(() =>
      postBff(`/api/access/requests/${request.id}/cancel`),
    );
    setPending(false);
    if (!result.ok) {
      setDecisionFailure(failure(result.code));
      return;
    }
    setMessage(success('요청을 취소했습니다.'));
    router.refresh();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') ?? '').trim();
    setPending(true);
    setNewFailure(null);
    const result = await withReauthentication(() =>
      postBff('/api/access/requests', {
        kind: String(form.get('kind')),
        targetAccountId: String(form.get('targetAccountId') ?? '').trim(),
        targetRole: String(form.get('targetRole')),
        ...(reason ? { reason } : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setNewFailure(failure(result.code));
      return;
    }
    setNewOpen(false);
    setMessage(success('권한 요청을 만들었습니다. 다른 승인 권한 운영자가 결정합니다.'));
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="권한 요청"
        meta={`이 목록의 대기 ${pendingCount}건`}
        actions={
          canRequest ? (
            <Button
              disabled={pending}
              onClick={() => {
                setNewFailure(null);
                setNewOpen(true);
              }}
            >
              <Icon name="plus" className="size-4" />새 요청
            </Button>
          ) : null
        }
      />
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
          selectedId={selected?.id ?? null}
          onSelect={(requestId) => {
            setDecisionFailure(null);
            setSelectedId(requestId);
          }}
        />
        {selected ? (
          <RequestDetail
            key={selected.id}
            request={selected}
            accounts={accounts}
            self={selected.requestedByAccountId === selfAccountId}
            canApprove={canApprove}
            canCancel={canRequest && selected.requestedByAccountId === selfAccountId}
            pending={pending}
            failure={decisionFailure}
            onDecide={(approve, reason) => void decide(selected, approve, reason)}
            onCancel={() => void cancel(selected)}
          />
        ) : requests.length ? (
          <Card id="access-detail">
            <p className="text-body text-fg-description">왼쪽 목록에서 요청을 고르세요.</p>
          </Card>
        ) : null}
      </div>
      {newOpen ? (
        <NewRequestDrawer
          roles={roles}
          accounts={accounts}
          pending={pending}
          failure={newFailure}
          onSubmit={(event) => void create(event)}
          onClose={() => setNewOpen(false)}
        />
      ) : null}
    </>
  );
}
