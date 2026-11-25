'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { AccountListResponse, InvitationCreatedResponse } from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatKstDetail, formatKstShort } from '@/ui/format';
import { Icon } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { PageHeader } from '@/ui/PageHeader';
import { success, useFailure, type ResultMessage } from '@/ui/result-message';
import { AccountTable } from './AccountTable';
import { DeactivateDialog } from './DeactivateDialog';
import { InviteDrawer } from './InviteDrawer';

/**
 * Operator accounts and invitations (owner role only, README §4): a list with the invitation in a right drawer and the
 * deactivation confirmed in a dialog (design guide ④ list). A drawer or dialog closes on success and the result shows
 * under the page title; a failure stays inside it.
 */
export function AccountsScreen({
  data,
  selfAccountId,
  canDeactivate,
}: {
  readonly data: AccountListResponse;
  readonly selfAccountId: string;
  readonly canDeactivate: boolean;
}) {
  const router = useRouter();
  const failure = useFailure();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [issued, setIssued] = useState<InvitationCreatedResponse | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFailure, setInviteFailure] = useState<ResultMessage | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivateFailure, setDeactivateFailure] = useState<ResultMessage | null>(null);
  const deactivating = data.accounts.find((account) => account.id === deactivatingId) ?? null;
  const activeCount = data.accounts.filter((account) => account.status === 'ACTIVE').length;

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setInviteFailure(null);
    const result = await postBff<InvitationCreatedResponse>('/api/accounts/invitations', {
      email: String(form.get('email') ?? ''),
      displayName: String(form.get('displayName') ?? ''),
    });
    setPending(false);
    if (!result.ok) {
      setInviteFailure(failure(result.code));
      return;
    }
    setMessage(null);
    setIssued(result.data);
    setInviteOpen(false);
    router.refresh();
  }

  async function revoke(invitationId: string) {
    setPending(true);
    setMessage(null);
    const result = await postBff(`/api/accounts/invitations/${invitationId}/revoke`);
    setPending(false);
    setMessage(result.ok ? success('초대를 취소했습니다.') : failure(result.code));
    router.refresh();
  }

  async function deactivate(event: FormEvent<HTMLFormElement>, accountId: string) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    setPending(true);
    setDeactivateFailure(null);
    const result = await withReauthentication(() =>
      postBff(`/api/accounts/${accountId}/deactivate`, { reason }),
    );
    setPending(false);
    if (!result.ok) {
      setDeactivateFailure(failure(result.code));
      return;
    }
    setDeactivatingId(null);
    setMessage(success('계정을 비활성화했습니다. 그 계정의 역할과 접속도 끝났습니다.'));
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="운영자 계정"
        meta={`계정 ${data.accounts.length}개 · 활성 ${activeCount}개 · 열린 초대 ${data.invitations.length}개`}
        actions={
          <Button
            disabled={pending}
            onClick={() => {
              setInviteFailure(null);
              setInviteOpen(true);
            }}
          >
            <Icon name="plus" className="size-4" />
            운영자 초대
          </Button>
        }
      />
      {issued ? (
        // The one-time code stays until the operator leaves the page, also after the drawer closed (README §3).
        <Notice tone="success" role="status">
          <span className="flex flex-col gap-1">
            <span>초대 code를 만들었습니다. 이 화면을 떠나면 다시 볼 수 없습니다.</span>
            <span className="font-code break-all" data-testid="invitation-code">
              {issued.code}
            </span>
            <span>
              {formatKstDetail(issued.expiresAt)}까지 한 번 쓸 수 있습니다. 역할은 등록 뒤 권한
              요청으로 줍니다.
            </span>
          </span>
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} role={message.role}>
          {message.text}
        </Notice>
      ) : null}

      <Card id="accounts-list" title="계정" flush>
        <AccountTable
          accounts={data.accounts}
          selfAccountId={selfAccountId}
          canDeactivate={canDeactivate}
          pending={pending}
          onDeactivate={(accountId) => {
            setDeactivateFailure(null);
            setDeactivatingId(accountId);
          }}
        />
      </Card>

      <Card id="accounts-invitations" title="열린 초대">
        {data.invitations.length === 0 ? (
          <p className="text-body text-fg-description">열린 초대가 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-stroke-row">
            {data.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold text-fg-neutral">
                    {invitation.displayName}
                  </span>
                  <span className="wrap-anywhere text-caption text-fg-muted">
                    {invitation.email} · {formatKstShort(invitation.expiresAt)} KST까지
                  </span>
                </div>
                <Button
                  tone="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => void revoke(invitation.id)}
                >
                  <Icon name="close" className="size-4" />
                  초대 취소
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {inviteOpen ? (
        <InviteDrawer
          pending={pending}
          failure={inviteFailure}
          onSubmit={(event) => void invite(event)}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {deactivating ? (
        <DeactivateDialog
          target={deactivating}
          pending={pending}
          failure={deactivateFailure}
          onSubmit={(event) => void deactivate(event, deactivating.id)}
          onClose={() => setDeactivatingId(null)}
        />
      ) : null}
    </>
  );
}
