'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { BackofficeSessionScope, LoginPasswordResponse } from '@repo/shared/backoffice';
import { postBff } from '@/client/bff-client';
import { attempt, signWithPasskey } from '@/client/passkeys';
import { Button } from '@/ui/Button';
import { errorMessage } from '@/ui/error-messages';
import { TextField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';

type Step =
  | { readonly kind: 'password' }
  | { readonly kind: 'second-factor'; readonly challenge: LoginPasswordResponse }
  | {
      readonly kind: 'recovery';
      readonly challenge: LoginPasswordResponse;
      readonly method: 'totp' | 'recovery-code';
    };

const ENDED_NOTICES = {
  idle: '15분 동안 활동이 없어 접속이 끝났습니다. 다시 로그인하세요.',
  expired:
    '접속이 끝났습니다(15분 동안 활동이 없었거나 로그인한 지 8시간이 지났습니다). 다시 로그인하세요.',
  unconfirmed:
    '이 browser의 접속 정보는 지웠지만 백오피스 API가 로그아웃을 확인하지 못했습니다. 서버 쪽 접속은 15분 동안 활동이 없으면 끝납니다.',
  // The API answers a session another operator, a deactivation or another window ended as "no session" and does not
  // say which, so the notice does not either (README §4).
  closed:
    '이 접속은 끝났습니다. 다른 창에서 로그아웃했거나 역할·계정 상태가 바뀌었을 수 있습니다. 다시 로그인하세요.',
  'self-revoked': '내 역할 회수를 승인해 이 접속이 끝났습니다. 다시 로그인하세요.',
} as const;

export type EndedNotice = keyof typeof ENDED_NOTICES;

// An ended session reads as a warning (yellow) and my own revoke as information (blue); red stays for input errors
// (Owner E-Q15).
const ENDED_TONES: Record<EndedNotice, 'warning' | 'info'> = {
  idle: 'warning',
  expired: 'warning',
  unconfirmed: 'warning',
  closed: 'warning',
  'self-revoked': 'info',
};

/** The login page's `ended` query, kept only when it names a notice this screen knows. */
export function endedNotice(
  query: string | readonly string[] | null | undefined,
): EndedNotice | null {
  return typeof query === 'string' && Object.hasOwn(ENDED_NOTICES, query)
    ? (query as EndedNotice)
    : null;
}

/**
 * Two-step login (OA-R2): password, then a passkey. TOTP or a recovery code instead of the passkey
 * opens a recovery session that can only add a new passkey (README §3).
 */
export function LoginScreen({
  ended: query,
}: {
  readonly ended: string | readonly string[] | null | undefined;
}) {
  const ended = endedNotice(query);
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function enter(scope: BackofficeSessionScope) {
    router.replace(scope === 'RECOVERY' ? '/recovery' : '/');
    router.refresh();
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await postBff<LoginPasswordResponse>('/api/auth/login/password', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    setStep({ kind: 'second-factor', challenge: result.data });
  }

  async function loginWithPasskey(challenge: LoginPasswordResponse) {
    setPending(true);
    setError(null);
    const signed = await attempt(() => signWithPasskey(challenge.options));
    if (!signed.ok) {
      setPending(false);
      setError(errorMessage(signed.code));
      return;
    }
    const result = await postBff<{ scope: BackofficeSessionScope }>('/api/auth/login/passkey', {
      challengeId: challenge.challengeId,
      credential: signed.value,
    });
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      setStep({ kind: 'password' });
      return;
    }
    enter(result.data.scope);
  }

  async function submitRecovery(
    event: FormEvent<HTMLFormElement>,
    current: Extract<Step, { kind: 'recovery' }>,
  ) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    setPending(true);
    setError(null);
    const result = await postBff<{ scope: BackofficeSessionScope }>(
      current.method === 'totp' ? '/api/auth/login/totp' : '/api/auth/login/recovery-code',
      { challengeId: current.challenge.challengeId, code },
    );
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      setStep({ kind: 'password' });
      return;
    }
    enter(result.data.scope);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title-1 font-bold text-fg-neutral">백오피스 로그인</h1>
      {ended && step.kind === 'password' ? (
        <Notice tone={ENDED_TONES[ended]} role="alert">
          {ENDED_NOTICES[ended]}
        </Notice>
      ) : null}

      {step.kind === 'password' ? (
        <form onSubmit={submitPassword} className="flex flex-col gap-4" aria-label="비밀번호 확인">
          <TextField
            id="login-email"
            name="email"
            type="email"
            label="이메일"
            autoComplete="username"
            required
          />
          <TextField
            id="login-password"
            name="password"
            type="password"
            label="비밀번호"
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={pending} className="w-full">
            다음
          </Button>
        </form>
      ) : null}

      {step.kind === 'second-factor' ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-fg-description">등록한 passkey로 로그인을 마칩니다.</p>
          <Button
            disabled={pending}
            onClick={() => void loginWithPasskey(step.challenge)}
            className="w-full"
          >
            passkey로 로그인
          </Button>
          {step.challenge.recovery.totp || step.challenge.recovery.recoveryCode ? (
            <div className="flex flex-col gap-2 border-t border-stroke-subtle pt-4">
              <p className="text-body text-fg-description">
                passkey를 쓸 수 없으면 복구 로그인으로 새 passkey만 등록할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {step.challenge.recovery.totp ? (
                  <Button
                    tone="secondary"
                    disabled={pending}
                    onClick={() =>
                      setStep({ kind: 'recovery', challenge: step.challenge, method: 'totp' })
                    }
                  >
                    TOTP code로 복구 로그인
                  </Button>
                ) : null}
                {step.challenge.recovery.recoveryCode ? (
                  <Button
                    tone="secondary"
                    disabled={pending}
                    onClick={() =>
                      setStep({
                        kind: 'recovery',
                        challenge: step.challenge,
                        method: 'recovery-code',
                      })
                    }
                  >
                    복구 code로 복구 로그인
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step.kind === 'recovery' ? (
        <form
          onSubmit={(event) => void submitRecovery(event, step)}
          className="flex flex-col gap-4"
          aria-label="복구 로그인"
        >
          {step.method === 'totp' ? (
            <TextField
              id="login-totp"
              name="code"
              label="TOTP code(6자리)"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
            />
          ) : (
            <TextField
              id="login-recovery-code"
              name="code"
              label="복구 code"
              hint="XXXXX-XXXXX 형식입니다. 한 번 쓴 code는 다시 쓸 수 없습니다."
              autoComplete="off"
              required
            />
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              복구 로그인
            </Button>
            <Button
              tone="secondary"
              disabled={pending}
              onClick={() => setStep({ kind: 'second-factor', challenge: step.challenge })}
            >
              돌아가기
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
