export const AUTH_ACTION_FEEDBACK_COPY = {
  connectivity: '네트워크를 확인한 뒤 다시 시도해 주세요.',
  emailVerification: {
    sendFailedTitle: '인증 코드를 보내지 못했어요',
    verifyFailedTitle: '인증 코드를 확인하지 못했어요',
    invalidCode: '인증 코드가 올바르지 않습니다.',
    requiredCode: '인증 코드를 입력해 주세요.',
    resendSucceeded: {
      title: '새 인증 코드를 보냈어요',
      description: '메일에서 새 코드를 확인해 주세요.',
    },
  },
  retryAfter: {
    title: '잠시 후 다시 요청할 수 있어요',
  },
  verificationCodeUnavailable: {
    title: '인증 코드를 다시 받아 주세요',
    description: '새 코드로 다시 인증해 주세요.',
  },
} as const;
