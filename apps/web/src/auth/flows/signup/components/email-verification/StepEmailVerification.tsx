import { InputField } from '@/auth/components/form/InputField';
import { Button } from '@/components/ui/Button';
import { StepHeader } from '@/auth/components/StepHeader';
import { useSignupEmailVerification } from './useSignupEmailVerification';
import { EmailVerificationRequestPanel } from './EmailVerificationRequestPanel';
import { EmailVerificationCodePanel } from './EmailVerificationCodePanel';
import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import {
  AuthRemainingTime,
  formatAuthRemainingTime,
} from '@/auth/components/feedback/AuthRemainingTime';
import type { AuthActionFeedbackState } from '@/auth/components/feedback/auth-action-feedback.types';
import { Mail, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { SIGNUP_FEEDBACK_COPY } from '../../model/signup-feedback.copy';

interface StepEmailVerificationProps {
  email: string;
  onEmailChange: (email: string) => void;
  isVerified: boolean;
  onVerified: () => void;
  onNext: () => void;
  recoveryNotice?: string;
  recoveryEmailError?: string;
  onRecoveryErrorClear?: () => void;
}

export interface StepEmailVerificationViewProps extends StepEmailVerificationProps {
  verification: {
    verificationCode: string;
    emailError: string;
    codeError: string;
    actionFeedback: AuthActionFeedbackState | null;
    isAttemptsExhausted: boolean;
    isCodeSent: boolean;
    isSending: boolean;
    isVerifying: boolean;
    requestedEmail: string;
    isCountdownActive: boolean;
    countdown: number;
    emailRetryAfterSeconds: number;
    codeRetryAfterSeconds: number;
    onSendCodeAction: () => void;
    onVerifyCodeAction: () => void;
    onCodeChangeAction: (value: string) => void;
    onEmailChangeAction: () => void;
  };
}

export function StepEmailVerificationView({
  email,
  onEmailChange,
  isVerified,
  onNext,
  recoveryNotice,
  recoveryEmailError,
  onRecoveryErrorClear,
  verification,
}: StepEmailVerificationViewProps) {
  const retryAfterSeconds = Math.max(
    verification.emailRetryAfterSeconds,
    verification.codeRetryAfterSeconds,
  );

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<Mail className="size-8 text-(--knu-primary)" />}
        title="이메일 인증"
        description="강원대학교 이메일로 인증해주세요"
      />

      {recoveryNotice ? (
        <AuthActionFeedback
          variant="warning"
          title={SIGNUP_FEEDBACK_COPY.email.proofExpiredTitle}
          description={recoveryNotice}
          testId="signup-email-recovery-feedback"
        />
      ) : verification.actionFeedback ? (
        <AuthActionFeedback {...verification.actionFeedback} testId="signup-email-action-feedback">
          {retryAfterSeconds > 0 ? (
            <AuthRemainingTime
              value={formatAuthRemainingTime(retryAfterSeconds)}
              contextLabel="인증 요청 제한"
            />
          ) : null}
        </AuthActionFeedback>
      ) : null}

      <div className="space-y-4">
        <div className="relative">
          <InputField
            label="학교 이메일"
            type="email"
            placeholder="example@kangwon.ac.kr"
            value={email}
            onChange={(value) => {
              onEmailChange(value);
              verification.onEmailChangeAction();
              onRecoveryErrorClear?.();
            }}
            error={verification.emailError || recoveryEmailError}
            disabled={isVerified}
            inputClassName={isVerified ? 'truncate pr-28' : undefined}
          />
          {isVerified && (
            <div className="absolute right-4 top-11 flex items-center gap-1 text-green-600">
              <CheckCircle className="size-5" />
              <span className="text-sm font-semibold">인증완료</span>
            </div>
          )}
        </div>

        {!verification.isCodeSent && !isVerified && (
          <EmailVerificationRequestPanel
            isSending={verification.isSending}
            retryAfterSeconds={verification.emailRetryAfterSeconds}
            onSendCode={verification.onSendCodeAction}
          />
        )}

        {!verification.isCodeSent && !isVerified && (
          <p className="text-xs text-(--knu-text-tertiary)">
            이미 계정이 있다면{' '}
            <Link
              href="/login"
              className="font-semibold text-(--knu-primary) hover:text-(--knu-primary-hover) transition-colors"
            >
              로그인
            </Link>
            이나{' '}
            <Link
              href="/password-reset"
              className="font-semibold text-(--knu-primary) hover:text-(--knu-primary-hover) transition-colors"
            >
              비밀번호 찾기
            </Link>
            를 이용해요.
          </p>
        )}

        {verification.isCodeSent && !isVerified && (
          <EmailVerificationCodePanel
            verificationCode={verification.verificationCode}
            codeError={verification.codeError}
            isAttemptsExhausted={verification.isAttemptsExhausted}
            isVerifying={verification.isVerifying}
            isSending={verification.isSending}
            isCountdownActive={verification.isCountdownActive}
            emailRetryAfterSeconds={verification.emailRetryAfterSeconds}
            codeRetryAfterSeconds={verification.codeRetryAfterSeconds}
            countdown={verification.countdown}
            onCodeChange={verification.onCodeChangeAction}
            onVerifyCode={verification.onVerifyCodeAction}
            onResendCode={verification.onSendCodeAction}
            onChangeEmail={verification.onEmailChangeAction}
          />
        )}
      </div>

      {isVerified && (
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          다음 단계
        </Button>
      )}
    </div>
  );
}

export function StepEmailVerification(props: StepEmailVerificationProps) {
  const verification = useSignupEmailVerification({
    email: props.email,
    onVerified: props.onVerified,
  });

  return (
    <StepEmailVerificationView
      {...props}
      verification={{
        verificationCode: verification.verificationCode,
        emailError: verification.emailError,
        codeError: verification.codeError,
        actionFeedback: verification.actionFeedback,
        isAttemptsExhausted: verification.isAttemptsExhausted,
        isCodeSent: verification.isCodeSent,
        isSending: verification.isSending,
        isVerifying: verification.isVerifying,
        requestedEmail: verification.requestedEmail,
        isCountdownActive: verification.isCountdownActive,
        countdown: verification.countdown,
        emailRetryAfterSeconds: verification.emailRetryAfterSeconds,
        codeRetryAfterSeconds: verification.codeRetryAfterSeconds,
        onSendCodeAction: verification.handleSendCode,
        onVerifyCodeAction: verification.handleVerifyCode,
        onCodeChangeAction: verification.handleCodeChange,
        onEmailChangeAction: verification.handleEmailChange,
      }}
    />
  );
}
