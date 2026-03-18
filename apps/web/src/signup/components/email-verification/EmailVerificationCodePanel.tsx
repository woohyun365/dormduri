import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';

interface EmailVerificationCodePanelProps {
  verificationCode: string;
  codeError: string;
  isVerifying: boolean;
  isSending: boolean;
  isCountdownActive: boolean;
  countdown: number;
  formatTime: () => string;
  onCodeChange: (value: string) => void;
  onVerifyCode: () => void;
  onResendCode: () => void;
}

export function EmailVerificationCodePanel({
  verificationCode,
  codeError,
  isVerifying,
  isSending,
  isCountdownActive,
  countdown,
  formatTime,
  onCodeChange,
  onVerifyCode,
  onResendCode,
}: EmailVerificationCodePanelProps) {
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
          disabled={isSending || isCountdownActive || isVerifying}
        >
          재전송{isCountdownActive ? ` (${formatTime()})` : ''}
        </Button>
        <Button variant="primary" size="lg" fullWidth onClick={onVerifyCode} disabled={isVerifying}>
          {isVerifying ? '확인 중...' : '인증 확인'}
        </Button>
      </div>

      <div className="space-y-1 text-xs text-[var(--knu-text-tertiary)]">
        <p className="font-medium text-[var(--knu-text-secondary)]">메일이 도착하지 않나요?</p>
        <ul className="space-y-0.5">
          <li>· 스팸 메일함을 확인해주세요.</li>
          <li>· 이메일 주소가 잘못됐다면 위에서 수정 후 재전송해주세요.</li>
        </ul>
      </div>
    </>
  );
}
