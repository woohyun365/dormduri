'use client';

import { useState, type FormEvent } from 'react';
import type { IssuedTotp } from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { Button } from '@/ui/Button';
import { errorMessage } from '@/ui/error-messages';
import { TextField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';

/**
 * TOTP secret and recovery codes appear once, right after they are issued (OA-R2, README §3). The screen keeps
 * them only in memory; leaving it drops them.
 */
export function RecoveryCodeList({ codes }: { readonly codes: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-fg-description">
        복구 code {codes.length}개입니다. 한 번씩만 쓸 수 있고 이 화면을 떠나면 다시 볼 수 없습니다.
        오프라인에 보관하세요.
      </p>
      <ol
        aria-label="복구 code"
        className="grid grid-cols-2 gap-2 font-code text-body text-fg-neutral"
      >
        {codes.map((code) => (
          <li key={code} className="rounded-control bg-layer-muted px-3 py-1.5">
            {code}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TotpEnrollment({
  totp,
  onConfirmed,
}: {
  readonly totp: IssuedTotp;
  readonly onConfirmed: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    setPending(true);
    setError(null);
    const result = await postBff('/api/auth/totp/confirm', { code });
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    onConfirmed();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-fg-description">
        인증 앱에 아래 비밀 값을 직접 입력하거나 URI를 붙여 넣으세요. TOTP는 passkey를 잃었을 때 새
        passkey를 등록하는 데만 씁니다.
      </p>
      <dl className="grid grid-cols-label-value gap-x-4 gap-y-2 rounded-control bg-layer-muted px-4 py-3 text-body">
        <dt className="font-medium text-fg-label">비밀 값</dt>
        <dd className="font-code break-all text-fg-neutral" data-testid="totp-secret">
          {totp.secret}
        </dd>
        <dt className="font-medium text-fg-label">URI</dt>
        <dd className="font-code break-all text-fg-neutral">{totp.uri}</dd>
      </dl>
      <form
        onSubmit={(event) => void confirm(event)}
        className="flex flex-col gap-3"
        aria-label="TOTP 확인"
      >
        <TextField
          id="totp-confirm-code"
          name="code"
          label="인증 앱의 6자리 code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
        />
        <Button type="submit" disabled={pending}>
          TOTP 확인
        </Button>
      </form>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
