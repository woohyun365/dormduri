'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { AccountListResponse, InvitationCreatedResponse } from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { errorMessage } from '@/ui/error-messages';
import { formatKst } from '@/ui/format';
import {
  Button,
  FormMessage,
  Section,
  SecondaryButton,
  TextAreaField,
  TextField,
} from '@/ui/forms';
import { ROLE_LABELS } from '@/ui/labels';

type Message = { readonly tone: 'error' | 'success'; readonly text: string } | null;

/** Operator accounts and invitations (owner role only, README §4). */
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
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [issued, setIssued] = useState<InvitationCreatedResponse | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setMessage(null);
    const result = await postBff<InvitationCreatedResponse>('/api/accounts/invitations', {
      email: String(form.get('email') ?? ''),
      displayName: String(form.get('displayName') ?? ''),
    });
    setPending(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: errorMessage(result.code) });
      return;
    }
    formElement.reset();
    setIssued(result.data);
    router.refresh();
  }

  async function revoke(invitationId: string) {
    setPending(true);
    setMessage(null);
    const result = await postBff(`/api/accounts/invitations/${invitationId}/revoke`);
    setPending(false);
    setMessage(
      result.ok
        ? { tone: 'success', text: '초대를 취소했습니다.' }
        : { tone: 'error', text: errorMessage(result.code) },
    );
    router.refresh();
  }

  async function deactivate(event: FormEvent<HTMLFormElement>, accountId: string) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    setPending(true);
    setMessage(null);
    const result = await withReauthentication(() =>
      postBff(`/api/accounts/${accountId}/deactivate`, { reason }),
    );
    setPending(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: errorMessage(result.code) });
      return;
    }
    setDeactivating(null);
    setMessage({
      tone: 'success',
      text: '계정을 비활성화했습니다. 그 계정의 역할과 접속도 끝났습니다.',
    });
    router.refresh();
  }

  return (
    <>
      <h1 className="text-title-1 font-semibold text-fg-neutral">운영자 계정</h1>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <Section id="accounts-list" title="계정">
        <table className="w-full text-left text-body">
          <thead className="text-fg-description">
            <tr>
              <th scope="col" className="py-2">
                이름
              </th>
              <th scope="col">이메일</th>
              <th scope="col">상태</th>
              <th scope="col">역할</th>
              <th scope="col">마지막 로그인</th>
              <th scope="col">
                <span className="sr-only">작업</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-row">
            {data.accounts.map((account) => (
              <tr key={account.id}>
                <td className="py-2">{account.displayName}</td>
                <td>{account.email}</td>
                <td>
                  {account.status === 'ACTIVE' ? '활성' : '비활성'}
                  {account.locked ? ' · 잠김' : ''}
                </td>
                <td>
                  {account.roles.length
                    ? account.roles.map((role) => ROLE_LABELS[role]).join(', ')
                    : '없음'}
                </td>
                <td>{formatKst(account.lastLoginAt)}</td>
                <td>
                  {canDeactivate && account.status === 'ACTIVE' && account.id !== selfAccountId ? (
                    <SecondaryButton disabled={pending} onClick={() => setDeactivating(account.id)}>
                      비활성화
                    </SecondaryButton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deactivating ? (
          <form
            onSubmit={(event) => void deactivate(event, deactivating)}
            className="flex flex-col gap-3 border-t border-stroke-subtle pt-4"
            aria-label="계정 비활성화"
          >
            <TextAreaField
              id="deactivate-reason"
              name="reason"
              label="비활성화 사유"
              hint="업무 변경·퇴직 같은 사유만 적고 사용자 개인정보는 쓰지 마세요. passkey로 다시 확인합니다."
              maxLength={500}
              required
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                비활성화
              </Button>
              <SecondaryButton disabled={pending} onClick={() => setDeactivating(null)}>
                닫기
              </SecondaryButton>
            </div>
          </form>
        ) : null}
      </Section>

      <Section id="accounts-invitations" title="열린 초대">
        {data.invitations.length === 0 ? (
          <p className="text-body text-fg-description">열린 초대가 없습니다.</p>
        ) : null}
        <ul className="flex flex-col gap-2 text-body">
          {data.invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-3">
              <span>
                {invitation.displayName} · {invitation.email} · {formatKst(invitation.expiresAt)}
                까지
              </span>
              <SecondaryButton disabled={pending} onClick={() => void revoke(invitation.id)}>
                초대 취소
              </SecondaryButton>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="accounts-invite" title="운영자 초대">
        <form
          onSubmit={(event) => void invite(event)}
          className="flex flex-col gap-3"
          aria-label="운영자 초대"
        >
          <TextField
            id="invite-email"
            name="email"
            type="email"
            label="이메일"
            required
            maxLength={254}
          />
          <TextField id="invite-name" name="displayName" label="이름" required maxLength={80} />
          <Button type="submit" disabled={pending}>
            초대 code 만들기
          </Button>
        </form>
        {issued ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-box bg-success-weak px-3 py-2 text-body text-fg-success-strong"
          >
            <span>초대 code를 만들었습니다. 이 화면을 떠나면 다시 볼 수 없습니다.</span>
            <span className="font-code break-all" data-testid="invitation-code">
              {issued.code}
            </span>
            <span>
              {formatKst(issued.expiresAt)}까지 한 번 쓸 수 있습니다. 역할은 등록 뒤 권한 요청으로
              줍니다.
            </span>
          </div>
        ) : null}
      </Section>
    </>
  );
}
