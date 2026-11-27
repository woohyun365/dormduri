'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  BACKOFFICE_PASSWORD_MAX_LENGTH,
  BACKOFFICE_PASSWORD_MIN_LENGTH,
  type IssuedTotp,
  type RegistrationOptionsResponse,
} from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { attempt, createPasskey } from '@/client/passkeys';
import { RecoveryCodeList, TotpEnrollment } from '@/screens/credentials/IssuedCredentials';
import { Button } from '@/ui/Button';
import { errorMessage } from '@/ui/error-messages';
import { TextField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';

type Step =
  | { readonly kind: 'code' }
  | {
      readonly kind: 'credentials';
      readonly code: string;
      readonly invitation: RegistrationOptionsResponse;
    }
  | {
      readonly kind: 'issued';
      readonly totp: IssuedTotp;
      readonly recoveryCodes: readonly string[];
    }
  | { readonly kind: 'done'; readonly recoveryCodes: readonly string[] };

/**
 * Invitation registration (OA-R1, OA-R10): the one-time code, a password and a passkey, then the
 * TOTP secret and recovery codes shown once and the TOTP confirmation.
 */
export function RegistrationScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'code' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    setPending(true);
    setError(null);
    const result = await postBff<RegistrationOptionsResponse>('/api/auth/registration/options', {
      code,
    });
    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'authentication_failed' || result.code === 'not_found'
          ? '등록 code가 맞지 않거나 이미 쓰였거나 만료됐습니다.'
          : errorMessage(result.code),
      );
      return;
    }
    setStep({ kind: 'credentials', code, invitation: result.data });
  }

  async function register(
    event: FormEvent<HTMLFormElement>,
    current: Extract<Step, { kind: 'credentials' }>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('passwordConfirm') ?? '')) {
      setError('두 비밀번호가 같지 않습니다.');
      return;
    }
    const label = String(form.get('passkeyLabel') ?? '').trim();
    setPending(true);
    setError(null);
    const created = await attempt(() => createPasskey(current.invitation.options));
    if (!created.ok) {
      setPending(false);
      setError(errorMessage(created.code));
      return;
    }
    const result = await postBff<{ totp: IssuedTotp; recoveryCodes: string[] }>(
      '/api/auth/registration',
      {
        code: current.code,
        password,
        challengeId: current.invitation.challengeId,
        credential: created.value,
        ...(label ? { passkeyLabel: label } : {}),
      },
    );
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    setStep({ kind: 'issued', totp: result.data.totp, recoveryCodes: result.data.recoveryCodes });
  }

  function start() {
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title-1 font-bold text-fg-neutral">운영자 등록</h1>

      {step.kind === 'code' ? (
        <form
          onSubmit={(event) => void submitCode(event)}
          className="flex flex-col gap-4"
          aria-label="등록 code 확인"
        >
          <TextField
            id="registration-code"
            name="code"
            label="등록 code"
            hint="owner에게 받은 1회용 code입니다. 발급 뒤 15분 안에 한 번만 쓸 수 있습니다."
            autoComplete="off"
            required
          />
          <Button type="submit" disabled={pending} className="w-full">
            다음
          </Button>
        </form>
      ) : null}

      {step.kind === 'credentials' ? (
        <form
          onSubmit={(event) => void register(event, step)}
          className="flex flex-col gap-4"
          aria-label="비밀번호와 passkey 등록"
        >
          <dl className="grid grid-cols-label-value gap-x-4 gap-y-1 rounded-control bg-layer-muted px-4 py-3 text-body">
            <dt className="font-medium text-fg-label">이메일</dt>
            <dd className="text-fg-neutral">{step.invitation.email}</dd>
            <dt className="font-medium text-fg-label">이름</dt>
            <dd className="text-fg-neutral">{step.invitation.displayName}</dd>
          </dl>
          <TextField
            id="registration-password"
            name="password"
            type="password"
            label="비밀번호"
            hint={`${BACKOFFICE_PASSWORD_MIN_LENGTH}자 이상 ${BACKOFFICE_PASSWORD_MAX_LENGTH}자 이하입니다.`}
            autoComplete="new-password"
            minLength={BACKOFFICE_PASSWORD_MIN_LENGTH}
            maxLength={BACKOFFICE_PASSWORD_MAX_LENGTH}
            required
          />
          <TextField
            id="registration-password-confirm"
            name="passwordConfirm"
            type="password"
            label="비밀번호 확인"
            autoComplete="new-password"
            minLength={BACKOFFICE_PASSWORD_MIN_LENGTH}
            maxLength={BACKOFFICE_PASSWORD_MAX_LENGTH}
            required
          />
          <TextField
            id="registration-passkey-label"
            name="passkeyLabel"
            label="passkey 이름(선택)"
            maxLength={60}
          />
          <Button type="submit" disabled={pending} className="w-full">
            passkey 만들고 등록
          </Button>
        </form>
      ) : null}

      {step.kind === 'issued' ? (
        <div className="flex flex-col gap-6">
          <Notice tone="success" role="status">
            등록했습니다. 아래 값은 지금 한 번만 보입니다.
          </Notice>
          <RecoveryCodeList codes={step.recoveryCodes} />
          <TotpEnrollment
            totp={step.totp}
            onConfirmed={() => setStep({ kind: 'done', recoveryCodes: step.recoveryCodes })}
          />
          <Button tone="secondary" wrap onClick={start} className="self-start">
            TOTP는 나중에 확인하고 시작하기
          </Button>
        </div>
      ) : null}

      {step.kind === 'done' ? (
        <div className="flex flex-col gap-4">
          <Notice tone="success" role="status">
            TOTP를 확인했습니다.
          </Notice>
          <Button onClick={start} className="w-full">
            시작하기
          </Button>
        </div>
      ) : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
