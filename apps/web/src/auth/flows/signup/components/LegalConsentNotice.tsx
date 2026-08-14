import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import { AuthFeedbackStrip } from '@/auth/components/feedback/AuthFeedbackStrip';
import { SIGNUP_FEEDBACK_COPY } from '../model/signup-feedback.copy';

type LegalConsentNoticeStatus = 'fallback' | 'stale';

interface LegalConsentNoticeProps {
  status: LegalConsentNoticeStatus;
  isUsingFallback?: boolean;
}

export function LegalConsentNotice({ status, isUsingFallback = false }: LegalConsentNoticeProps) {
  const isStaleFallback = status === 'stale' && isUsingFallback;
  const copy = isStaleFallback
    ? SIGNUP_FEEDBACK_COPY.legal.staleFallback
    : SIGNUP_FEEDBACK_COPY.legal[status];

  if (status === 'stale') {
    return (
      <AuthActionFeedback
        variant="warning"
        title={copy.title}
        description={copy.description}
        testId="signup-legal-feedback"
      />
    );
  }

  return (
    <AuthFeedbackStrip
      variant="info"
      role="status"
      title={copy.title}
      description={copy.description}
      testId="signup-legal-feedback"
    />
  );
}
