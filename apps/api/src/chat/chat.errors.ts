import { conflictError, notFoundError } from '../common/http/api-error.js';

export const chatErrors = {
  threadTargetNotFound() {
    return notFoundError('CHAT_THREAD_TARGET_NOT_FOUND', '채팅 대상을 찾을 수 없습니다.');
  },

  threadNotFound() {
    return notFoundError('CHAT_THREAD_NOT_FOUND', '조회할 수 없는 채팅입니다.');
  },

  messageSendNotAllowed() {
    return conflictError(
      'CHAT_MESSAGE_SEND_NOT_ALLOWED',
      '현재 상태에서는 메시지를 보낼 수 없습니다.',
    );
  },

  threadLeaveNotAllowed() {
    return conflictError(
      'CHAT_THREAD_LEAVE_NOT_ALLOWED',
      '현재 상태에서는 이 채팅에서 나갈 수 없습니다.',
    );
  },
};
