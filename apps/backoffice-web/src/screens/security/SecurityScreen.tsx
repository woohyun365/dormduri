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
import { errorMessage } from '@/ui/error-messages';
import { Button, FormMessage, Section, SecondaryButton, TextField } from '@/ui/forms';

/** The operator's own credentials (README §3). Every change asks for a recent passkey confirmation. */
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
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
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
      setMessage({ tone: 'error', text: errorMessage(options.code) });
      return;
    }
    const created = await attempt(() => createPasskey(options.data.options));
    if (!created.ok) {
      setPending(false);
      setMessage({ tone: 'error', text: errorMessage(created.code) });
      return;
    }
    const result = await postBff('/api/auth/passkeys', {
      challengeId: options.data.challengeId,
      credential: created.value,
      ...(label ? { label } : {}),
    });
    setPending(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: errorMessage(result.code) });
      return;
    }
    setMessage({ tone: 'success', text: 'passkey를 추가했습니다.' });
    router.refresh();
  }

  async function reissueTotp() {
    setPending(true);
    setMessage(null);
    const result = await withReauthentication(() => postBff<IssuedTotp>('/api/auth/totp'));
    setPending(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: errorMessage(result.code) });
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
      setMessage({ tone: 'error', text: errorMessage(result.code) });
      return;
    }
    setCodes(result.data.recoveryCodes);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-title-1 font-semibold text-fg-neutral">내 보안 설정</h1>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <Section id="security-passkeys" title="passkey">
        <p className="text-body text-fg-description">등록한 passkey {passkeyCount}개</p>
        <form
          onSubmit={(event) => void addPasskey(event)}
          className="flex flex-col gap-3"
          aria-label="passkey 추가"
        >
          <TextField
            id="security-passkey-label"
            name="label"
            label="새 passkey 이름(선택)"
            maxLength={60}
          />
          <Button type="submit" disabled={pending}>
            passkey 추가
          </Button>
        </form>
      </Section>

      <Section id="security-totp" title="TOTP(복구용)">
        <p className="text-body text-fg-description">
          {totpConfirmed ? '확인한 TOTP가 있습니다.' : '확인한 TOTP가 없습니다.'}
        </p>
        {totp ? (
          <TotpEnrollment
            totp={totp}
            onConfirmed={() => {
              setTotp(null);
              setMessage({ tone: 'success', text: 'TOTP를 확인했습니다.' });
              router.refresh();
            }}
          />
        ) : (
          <SecondaryButton disabled={pending} onClick={() => void reissueTotp()}>
            TOTP 새로 발급
          </SecondaryButton>
        )}
      </Section>

      <Section id="security-recovery-codes" title="복구 code">
        <p className="text-body text-fg-description">남은 복구 code {recoveryCodesRemaining}개</p>
        {codes ? <RecoveryCodeList codes={codes} /> : null}
        <SecondaryButton disabled={pending} onClick={() => void reissueRecoveryCodes()}>
          복구 code 새로 발급(이전 code는 쓸 수 없게 됨)
        </SecondaryButton>
      </Section>
    </>
  );
}
