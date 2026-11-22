'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { WebAuthnChallengeResponse } from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { attempt, createPasskey } from '@/client/passkeys';
import { errorMessage } from '@/ui/error-messages';
import { Button, FormMessage, SecondaryButton, TextField } from '@/ui/forms';

/**
 * Recovery session (OA-R2): it may only add a new passkey and log out. The operator then logs in
 * again with the new passkey for a full session.
 */
export function RecoveryScreen({ displayName }: { readonly displayName: string }) {
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function addPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get('label') ?? '').trim();
    setPending(true);
    setError(null);
    const options = await postBff<WebAuthnChallengeResponse>('/api/auth/passkeys/options');
    if (!options.ok) {
      setPending(false);
      setError(errorMessage(options.code));
      return;
    }
    const created = await attempt(() => createPasskey(options.data.options));
    if (!created.ok) {
      setPending(false);
      setError(errorMessage(created.code));
      return;
    }
    const result = await postBff('/api/auth/passkeys', {
      challengeId: options.data.challengeId,
      credential: created.value,
      ...(label ? { label } : {}),
    });
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    setRegistered(true);
  }

  async function logout() {
    setPending(true);
    await postBff('/api/auth/logout');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">복구 로그인</h1>
      <p className="text-sm text-slate-700">
        {displayName}님은 복구 로그인 중입니다. 이 접속으로는 새 passkey 등록과 로그아웃만 할 수
        있습니다.
      </p>
      {registered ? (
        <FormMessage tone="success">
          새 passkey를 등록했습니다. 로그아웃한 뒤 새 passkey로 다시 로그인하세요.
        </FormMessage>
      ) : (
        <form
          onSubmit={(event) => void addPasskey(event)}
          className="flex flex-col gap-4"
          aria-label="새 passkey 등록"
        >
          <TextField
            id="recovery-passkey-label"
            name="label"
            label="passkey 이름(선택)"
            maxLength={60}
          />
          <Button type="submit" disabled={pending}>
            새 passkey 등록
          </Button>
        </form>
      )}
      <SecondaryButton disabled={pending} onClick={() => void logout()}>
        로그아웃
      </SecondaryButton>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
