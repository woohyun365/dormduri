import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SignupGlobalAlertProps {
  message: string;
  isVerificationExpiredError: boolean;
  isSubmitting: boolean;
  onRestartEmailVerification: () => void;
  onRetry: () => void | Promise<void>;
}

export const SignupGlobalAlert = forwardRef<HTMLDivElement, SignupGlobalAlertProps>(
  function SignupGlobalAlert(
    { message, isVerificationExpiredError, isSubmitting, onRestartEmailVerification, onRetry },
    ref,
  ) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4"
      >
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
        <div className="flex-1">
          <p className="mb-3 text-sm font-medium text-red-900">{message}</p>
          {isVerificationExpiredError ? (
            <Button variant="outline" size="lg" onClick={onRestartEmailVerification}>
              이메일 다시 인증하기
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              onClick={() => void onRetry()}
              disabled={isSubmitting}
              aria-busy={isSubmitting ? 'true' : undefined}
            >
              {isSubmitting ? '처리 중...' : '다시 시도'}
            </Button>
          )}
        </div>
      </div>
    );
  },
);
