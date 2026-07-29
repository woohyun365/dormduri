import type { ReactNode } from 'react';
import Image from 'next/image';
import { AuthHeader } from '@/auth/components';
import { SessionUnavailableNotice } from '@/auth/components/SessionUnavailableNotice';
import { PasswordResetAuthenticatedNotice } from './PasswordResetAuthenticatedNotice';
import { PasswordResetProgress } from './PasswordResetProgress';
import { PasswordResetServiceNotice } from './PasswordResetServiceNotice';
import { PasswordResetStatusAlert } from './PasswordResetStatusAlert';
import type { PasswordResetStatus } from '../model/password-reset-flow.types';
import { PasswordResetEmailHelpMessage } from './PasswordResetEmailHelpMessage';

interface PasswordResetLayoutProps {
  children: ReactNode;
  currentStep: number;
  showBack: boolean;
  showProgress: boolean;
  status: PasswordResetStatus | null;
  isAuthenticated: boolean;
  isSessionUnavailable: boolean;
  onBack: () => void;
  onRestart: () => void;
  onRetrySession: () => void;
}

export function PasswordResetLayout({
  children,
  currentStep,
  showBack,
  showProgress,
  status,
  isAuthenticated,
  isSessionUnavailable,
  onBack,
  onRestart,
  onRetrySession,
}: PasswordResetLayoutProps) {
  const hasFeedback = isAuthenticated || isSessionUnavailable || Boolean(status);

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <AuthHeader
        showBack={showBack}
        onBack={onBack}
        containerClassName="mx-auto w-full max-w-5xl px-5 lg:px-8"
      />

      <main
        data-testid="password-reset-main-layout"
        className="mx-auto grid w-full max-w-5xl items-start gap-6 px-5 py-6 md:min-h-[calc(100vh-4rem)] md:gap-8 md:py-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:px-8"
      >
        <aside
          data-testid="password-reset-help-panel"
          aria-labelledby="password-reset-help-title"
          className="hidden rounded-3xl border-2 border-(--knu-border) bg-white p-8 shadow-sm lg:mt-32 lg:block"
        >
          <p className="mb-3 text-sm font-semibold text-(--knu-primary)">비밀번호 재설정</p>
          <h2
            id="password-reset-help-title"
            className="mb-4 text-3xl font-bold leading-tight text-(--knu-text-primary)"
          >
            강원대 이메일 인증 후 새 비밀번호로 다시 시작해요
          </h2>
          <p className="keep-all mb-8 text-base leading-7 text-(--knu-text-secondary)">
            <PasswordResetEmailHelpMessage />
          </p>

          <dl className="space-y-5">
            <div className="rounded-2xl bg-(--knu-background-alt) p-5">
              <dt className="font-semibold text-(--knu-text-primary)">
                메일함과 스팸함을 확인해주세요
              </dt>
              <dd className="mt-1 text-sm leading-6 text-(--knu-text-secondary)">
                인증 코드는 짧게 유효해요. 시간이 지나면 재전송으로 새 코드를 받아주세요.
              </dd>
            </div>
            <div className="rounded-2xl bg-(--knu-background-alt) p-5">
              <dt className="font-semibold text-(--knu-text-primary)">새 비밀번호만 저장돼요</dt>
              <dd className="mt-1 text-sm leading-6 text-(--knu-text-secondary)">
                기존 비밀번호와 같은 값은 사용할 수 없고, 인증 코드와 새 비밀번호는 브라우저
                저장소에 남기지 않습니다.
              </dd>
            </div>
            <div className="rounded-2xl bg-(--knu-background-alt) p-5">
              <dt className="font-semibold text-(--knu-text-primary)">성공 후 다시 로그인해요</dt>
              <dd className="mt-1 text-sm leading-6 text-(--knu-text-secondary)">
                보안을 위해 기존 로그인 상태는 모두 종료되며, 새 비밀번호로 다시 로그인해야 합니다.
              </dd>
            </div>
          </dl>
        </aside>

        <section aria-labelledby="password-reset-title" className="mx-auto w-full max-w-md lg:mx-0">
          <div className="mb-6 text-center sm:mb-8 lg:mb-10">
            <Image
              src="/knu_logo.svg"
              alt="KNU 로고"
              width={80}
              height={80}
              className="mx-auto mb-5 rounded-full shadow-lg sm:mb-6"
            />
            <h1
              id="password-reset-title"
              className="mb-2 text-3xl font-bold text-(--knu-text-primary) md:mb-3 md:text-4xl"
            >
              비밀번호 재설정
            </h1>
            <p className="keep-all text-(--knu-text-secondary)">
              학교 이메일 인증으로 본인 확인을 마친 뒤 새 비밀번호를 설정합니다.
            </p>
            <PasswordResetServiceNotice />
          </div>

          <div
            data-testid="password-reset-flow-card"
            className="rounded-2xl border-2 border-(--knu-border) bg-white p-5 shadow-sm md:p-8"
          >
            {showProgress && <PasswordResetProgress currentStep={currentStep} />}

            <div data-testid="password-reset-form-stack" className="space-y-5">
              {children}
              {hasFeedback && (
                <div data-testid="password-reset-feedback-region" className="space-y-3 pt-1">
                  {isAuthenticated && <PasswordResetAuthenticatedNotice />}
                  {isSessionUnavailable && (
                    <SessionUnavailableNotice
                      onRetryAction={onRetrySession}
                      message="로그인 상태를 확인하지 못했지만 비밀번호 재설정은 계속할 수 있어요."
                    />
                  )}
                  <PasswordResetStatusAlert status={status} onRestart={onRestart} />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
