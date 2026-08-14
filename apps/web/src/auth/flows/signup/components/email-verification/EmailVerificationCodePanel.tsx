import { InputField } from '@/auth/components/form/InputField';
import { formatCompactAuthRemainingTime } from '@/auth/components/feedback/AuthRemainingTime';
import { AuthEmailDeliveryHelp } from '@/auth/components';
import { Button } from '@/components/ui/Button';

interface EmailVerificationCodePanelProps {
  verificationCode: string;
  codeError: string;
  isAttemptsExhausted: boolean;
  isVerifying: boolean;
  isSending: boolean;
  isCountdownActive: boolean;
  emailRetryAfterSeconds?: number;
  codeRetryAfterSeconds?: number;
  countdown: number;
  onCodeChange: (value: string) => void;
  onVerifyCode: () => void;
  onResendCode: () => void;
  onChangeEmail: () => void;
}

export function EmailVerificationCodePanel({
  verificationCode,
  codeError,
  isAttemptsExhausted,
  isVerifying,
  isSending,
  isCountdownActive,
  emailRetryAfterSeconds = 0,
  codeRetryAfterSeconds = 0,
  countdown,
  onCodeChange,
  onVerifyCode,
  onResendCode,
  onChangeEmail,
}: EmailVerificationCodePanelProps) {
  const isEmailRetryAfterActive = emailRetryAfterSeconds > 0;
  const isCodeRetryAfterActive = codeRetryAfterSeconds > 0;

  return (
    <>
      <div className="relative">
        <InputField
          label="인증 코드"
          type="text"
          placeholder="6자리 인증 코드"
          value={verificationCode}
          onChange={onCodeChange}
          error={codeError}
          maxLength={6}
          disabled={isVerifying || isAttemptsExhausted}
        />
        {!isCountdownActive && !isAttemptsExhausted && !isSending && (
          <p className="mt-1 text-sm font-semibold leading-5 text-red-500" aria-live="assertive">
            인증 시간이 만료되었어요. 재전송 버튼을 눌러주세요.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={onResendCode}
          disabled={
            isSending ||
            (isCountdownActive && !isAttemptsExhausted) ||
            isVerifying ||
            isEmailRetryAfterActive
          }
        >
          {isSending
            ? '전송 중...'
            : isCountdownActive && !isAttemptsExhausted
              ? `재전송 · ${formatCompactAuthRemainingTime(countdown)}`
              : '재전송'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onVerifyCode}
          disabled={isSending || isVerifying || isCodeRetryAfterActive || isAttemptsExhausted}
        >
          {isVerifying ? '확인 중...' : '인증 확인'}
        </Button>
      </div>

      <AuthEmailDeliveryHelp onChangeEmailAction={onChangeEmail} />
    </>
  );
}
