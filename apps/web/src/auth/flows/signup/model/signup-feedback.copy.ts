import { AUTH_ACTION_FEEDBACK_COPY } from '@/auth/components/feedback/auth-action-feedback.copy';

export const SIGNUP_FEEDBACK_COPY = {
  sessionUnavailable: {
    title: '로그인 상태를 확인하지 못했어요',
    description: '회원가입은 계속할 수 있어요.',
  },
  email: {
    sendFailedTitle: AUTH_ACTION_FEEDBACK_COPY.emailVerification.sendFailedTitle,
    verificationFailedTitle: AUTH_ACTION_FEEDBACK_COPY.emailVerification.verifyFailedTitle,
    invalidCode: AUTH_ACTION_FEEDBACK_COPY.emailVerification.invalidCode,
    requiredCode: AUTH_ACTION_FEEDBACK_COPY.emailVerification.requiredCode,
    resendSucceeded: AUTH_ACTION_FEEDBACK_COPY.emailVerification.resendSucceeded,
    proofExpiredTitle: '학교 이메일 인증이 만료됐어요',
    proofExpiredDescription: '학교 이메일을 다시 인증해 주세요.',
  },
  credentials: {
    unavailableTitle: '입력 내용을 확인하지 못했어요',
  },
  academic: {
    submissionFailedTitle: '가입을 완료하지 못했어요',
  },
  legal: {
    fallback: {
      title: '저장된 동의 내용을 보여드려요',
      description: '가입할 때 최신 내용인지 다시 확인해요.',
    },
    stale: {
      title: '동의 내용이 변경됐어요',
      description: '최신 내용을 확인하고 다시 동의해 주세요.',
    },
    staleFallback: {
      title: '동의 내용을 다시 확인해 주세요',
      description: '저장된 내용을 보여드리며, 가입할 때 최신 여부를 확인해요.',
    },
  },
  common: {
    connectivity: AUTH_ACTION_FEEDBACK_COPY.connectivity,
    retry: '잠시 후 다시 시도해 주세요.',
    retryAfter: AUTH_ACTION_FEEDBACK_COPY.retryAfter,
    verificationCodeUnavailable: AUTH_ACTION_FEEDBACK_COPY.verificationCodeUnavailable,
  },
} as const;
