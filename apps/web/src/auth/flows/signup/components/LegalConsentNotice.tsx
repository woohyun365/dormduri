import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import { SIGNUP_FEEDBACK_COPY } from '../model/signup-feedback.copy';

type LegalConsentNoticeStatus = 'unavailable' | 'stale';

interface LegalConsentNoticeProps {
  status: LegalConsentNoticeStatus;
  /** Reads the signup documents again (unavailable only). */
  onRetry?: () => void;
}

export function LegalConsentNotice({ status, onRetry }: LegalConsentNoticeProps) {
  if (status === 'unavailable') {
    const copy = SIGNUP_FEEDBACK_COPY.legal.unavailable;
    return (
      <AuthActionFeedback
        variant="error"
        title={copy.title}
        description={copy.description}
        testId="signup-legal-feedback"
      >
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-(--knu-border) bg-white px-4 text-sm font-semibold text-(--knu-text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
          >
            {copy.retry}
          </button>
        )}
      </AuthActionFeedback>
    );
  }

  const copy = SIGNUP_FEEDBACK_COPY.legal.stale;
  return (
    <AuthActionFeedback
      variant="warning"
      title={copy.title}
      description={copy.description}
      testId="signup-legal-feedback"
    />
  );
}
