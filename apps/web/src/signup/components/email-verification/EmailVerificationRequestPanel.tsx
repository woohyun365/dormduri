import { Button } from '@/components/Button';

interface EmailVerificationRequestPanelProps {
  isSending: boolean;
  onSendCode: () => void;
}

export function EmailVerificationRequestPanel({
  isSending,
  onSendCode,
}: EmailVerificationRequestPanelProps) {
  return (
    <Button variant="primary" size="lg" fullWidth onClick={onSendCode} disabled={isSending}>
      {isSending ? '전송 중...' : '인증 코드 전송'}
    </Button>
  );
}
