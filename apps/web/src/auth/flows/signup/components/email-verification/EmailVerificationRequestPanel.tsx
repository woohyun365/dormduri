import { Button } from '@/components/ui/Button';

interface EmailVerificationRequestPanelProps {
  isSending: boolean;
  retryAfterSeconds?: number;
  onSendCode: () => void;
}

export function EmailVerificationRequestPanel({
  isSending,
  retryAfterSeconds = 0,
  onSendCode,
}: EmailVerificationRequestPanelProps) {
  const isRetryAfterActive = retryAfterSeconds > 0;

  return (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      onClick={onSendCode}
      disabled={isSending || isRetryAfterActive}
    >
      {isSending
        ? '전송 중...'
        : isRetryAfterActive
          ? `${retryAfterSeconds}초 후 다시 전송`
          : '인증 코드 전송'}
    </Button>
  );
}
