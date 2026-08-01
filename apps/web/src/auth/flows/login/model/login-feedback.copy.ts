import { AUTH_ACTION_FEEDBACK_COPY } from '@/auth/components/feedback/auth-action-feedback.copy';

export const LOGIN_FEEDBACK_COPY = {
  invalidCredentials: '이메일 또는 비밀번호를 확인해 주세요.',
  locked: '반복된 로그인 실패로 계정이 잠겼어요.',
  throttled: '로그인 요청이 반복되어 로그인이 제한됐어요.',
  network: AUTH_ACTION_FEEDBACK_COPY.connectivity,
  server: '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
  sessionUnavailable: {
    title: '로그인 상태를 확인하지 못했어요',
    description: '로그인은 그대로 진행할 수 있어요.',
  },
  passwordResetComplete: {
    title: '비밀번호가 변경됐어요',
    description: '새 비밀번호로 다시 로그인해 주세요.',
  },
} as const;
