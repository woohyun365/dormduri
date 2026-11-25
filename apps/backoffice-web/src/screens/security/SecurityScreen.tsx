'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type {
  IssuedTotp,
  RecoveryCodesResponse,
  WebAuthnChallengeResponse,
} from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { attempt, createPasskey, withReauthentication } from '@/client/passkeys';
import { RecoveryCodeList, TotpEnrollment } from '@/screens/credentials/IssuedCredentials';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextField } from '@/ui/fields';
import { Icon } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { PageHeader } from '@/ui/PageHeader';
import { success, useFailure, type ResultMessage } from '@/ui/result-message';
import { StatusBadge } from '@/ui/status';

/**
 * The operator's own credentials (README §3) in three stacked sections (design guide ④). Every change asks for a recent
 * passkey confirmation; the result shows under the title.
 */
export function SecurityScreen({
  passkeyCount,
  totpConfirmed,
  recoveryCodesRemaining,
}: {
  readonly passkeyCount: number;
  readonly totpConfirmed: boolean;
  readonly recoveryCodesRemaining: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const failure = useFailure();
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [totp, setTotp] = useState<IssuedTotp | null>(null);
  const [codes, setCodes] = useState<readonly string[] | null>(null);

  async function addPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get('label') ?? '').trim();
    setPending(true);
    setMessage(null);
    const options = await withReauthentication(() =>
      postBff<WebAuthnChallengeResponse>('/api/auth/passkeys/options'),
    );
    if (!options.ok) {
      setPending(false);
      setMessage(failure(options.code));
      return;
    }
    const created = await attempt(() => createPasskey(options.data.options));
    if (!created.ok) {
      setPending(false);
      setMessage(failure(created.code));
      return;
    }
    const result = await postBff('/api/auth/passkeys', {
      challengeId: options.data.challengeId,
      credential: created.value,
      ...(label ? { label } : {}),
    });
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    setMessage(success('passkey를 추가했습니다.'));
    router.refresh();
  }

  async function reissueTotp() {
    setPending(true);
    setMessage(null);
    const result = await withReauthentication(() => postBff<IssuedTotp>('/api/auth/totp'));
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    setTotp(result.data);
    // The new secret replaces the confirmed one until it is confirmed too.
    router.refresh();
  }

  async function reissueRecoveryCodes() {
    setPending(true);
    setMessage(null);
    const result = await withReauthentication(() =>
      postBff<RecoveryCodesResponse>('/api/auth/recovery-codes'),
    );
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    setCodes(result.data.recoveryCodes);
    router.refresh();
  }

  return (
    <>
      <PageHeader title="내 보안 설정" />
      {message ? (
        <Notice tone={message.tone} role={message.role}>
          {message.text}
        </Notice>
      ) : null}
      <div className="flex flex-col gap-stack">
        <Card
          id="security-passkeys"
          title="passkey"
          action={<StatusBadge meaning="info">{passkeyCount}개</StatusBadge>}
        >
          <p className="text-body text-fg-description">등록한 passkey {passkeyCount}개</p>
          <form
            onSubmit={(event) => void addPasskey(event)}
            className="flex flex-wrap items-end gap-3"
            aria-label="passkey 추가"
          >
            <div className="min-w-60 flex-1">
              <TextField
                id="security-passkey-label"
                name="label"
                label="새 passkey 이름(선택)"
                maxLength={60}
              />
            </div>
            <Button type="submit" disabled={pending}>
              passkey 추가
            </Button>
          </form>
        </Card>

        <Card
          id="security-totp"
          title="TOTP(복구용)"
          action={
            totpConfirmed ? (
              <StatusBadge meaning="success">확인함</StatusBadge>
            ) : (
              <StatusBadge meaning="warning">확인 안 함</StatusBadge>
            )
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-fg-description">
              {totpConfirmed ? '확인한 TOTP가 있습니다.' : '확인한 TOTP가 없습니다.'}
            </p>
            {totp ? null : (
              <Button tone="secondary" disabled={pending} onClick={() => void reissueTotp()}>
                <Icon name="refresh" className="size-4" />
                TOTP 새로 발급
              </Button>
            )}
          </div>
          {totp ? (
            <TotpEnrollment
              totp={totp}
              onConfirmed={() => {
                setTotp(null);
                setMessage(success('TOTP를 확인했습니다.'));
                router.refresh();
              }}
            />
          ) : null}
        </Card>

        <Card
          id="security-recovery-codes"
          title="복구 code"
          action={
            <StatusBadge meaning={recoveryCodesRemaining === 0 ? 'warning' : 'info'}>
              {recoveryCodesRemaining}개
            </StatusBadge>
          }
        >
          {codes ? <RecoveryCodeList codes={codes} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-fg-description">
              남은 복구 code {recoveryCodesRemaining}개
            </p>
            <Button
              tone="secondary"
              wrap
              disabled={pending}
              onClick={() => void reissueRecoveryCodes()}
            >
              <Icon name="refresh" className="size-4 shrink-0" />
              복구 code 새로 발급(이전 code는 쓸 수 없게 됨)
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
