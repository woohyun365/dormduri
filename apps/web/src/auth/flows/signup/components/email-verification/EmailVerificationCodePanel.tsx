import { InputField } from '@/auth/components/form/InputField';
import { Button } from '@/components/ui/Button';

interface EmailVerificationCodePanelProps {
  email: string;
  verificationCode: string;
  codeError: string;
  isVerifying: boolean;
  isSending: boolean;
  isCountdownActive: boolean;
  emailRetryAfterSeconds?: number;
  codeRetryAfterSeconds?: number;
  countdown: number;
  formatTime: () => string;
  onCodeChange: (value: string) => void;
  onVerifyCode: () => void;
  onResendCode: () => void;
}

export function EmailVerificationCodePanel({
  email,
  verificationCode,
  codeError,
  isVerifying,
  isSending,
  isCountdownActive,
  emailRetryAfterSeconds = 0,
  codeRetryAfterSeconds = 0,
  countdown,
  formatTime,
  onCodeChange,
  onVerifyCode,
  onResendCode,
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
          disabled={isVerifying}
        />
        {isCountdownActive && (
          <div
            className="absolute right-4 top-11 text-sm font-semibold text-red-500"
            role="timer"
            aria-live={countdown % 30 === 0 ? 'polite' : 'off'}
          >
            {formatTime()}
          </div>
        )}
        {!isCountdownActive && (
          <p className="text-sm text-red-500 font-semibold mt-1" aria-live="assertive">
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
          disabled={isSending || isCountdownActive || isVerifying || isEmailRetryAfterActive}
        >
          {isEmailRetryAfterActive
            ? `${emailRetryAfterSeconds}초 후 재전송`
            : `재전송${isCountdownActive ? ` (${formatTime()})` : ''}`}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onVerifyCode}
          disabled={isVerifying || isCodeRetryAfterActive}
        >
          {isVerifying
            ? '확인 중...'
            : isCodeRetryAfterActive
              ? `${codeRetryAfterSeconds}초 후 다시 확인`
              : '인증 확인'}
        </Button>
      </div>

      <div className="space-y-1 text-xs text-(--knu-text-tertiary)">
        <p className="font-medium text-(--knu-text-secondary)">메일이 도착하지 않나요?</p>
        <ul className="space-y-0.5">
          <li>· 요청한 이메일: {email}</li>
          <li>· 스팸 메일함을 확인해주세요.</li>
          <li>· 이메일 주소가 잘못됐다면 위에서 수정 후 재전송해주세요.</li>
        </ul>
      </div>
    </>
  );
}
