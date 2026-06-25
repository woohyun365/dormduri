export const PASSWORD_RESET_COPY = {
  serviceNotice: {
    text: '본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.',
    linkLabel: '자세히 보기',
  },
  authenticatedNotice:
    '현재 로그인된 상태입니다. 현재 계정의 비밀번호 변경은 계정 설정에서 진행하고, 다른 계정을 재설정하려면 이 화면에서 계속 진행할 수 있어요.',
  emailHelp: {
    prefix: '메일이 오지 않으면 ',
    highlight: '주소와 스팸함',
    suffix: '을 확인해주세요.',
  },
  status: {
    defaultServerError: '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
    defaultNetworkError: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    networkTitle: '네트워크를 확인해주세요',
    retryAfterTitle: '잠시 후 다시 시도해주세요',
    sendCodeFailureTitle: '인증 코드를 보낼 수 없어요',
    verifyFailureTitle: '인증 코드를 확인하지 못했어요',
    verifyFailureMessage: '인증 코드가 올바르지 않습니다.',
    resetRestartTitle: '재설정을 처음부터 다시 진행해주세요',
    resetRestartMessage:
      '인증 시간이 만료되었거나 이미 사용된 요청입니다. 이메일 입력부터 다시 진행해주세요.',
    resetFailureTitle: '비밀번호를 변경하지 못했어요',
    resetFailureMessage: '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
  },
} as const;

export function createPasswordResetRetryAfterMessage(seconds: number) {
  return `너무 잦은 요청이에요. ${seconds}초 후 다시 시도해주세요.`;
}
