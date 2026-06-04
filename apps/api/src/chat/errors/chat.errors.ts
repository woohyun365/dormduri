import { badRequestError, conflictError, notFoundError } from '../../platform/http/api-error.js';

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

  messageClientMessageIdRequired() {
    return badRequestError(
      'CHAT_MESSAGE_CLIENT_MESSAGE_ID_REQUIRED',
      '메시지 중복 방지 식별자가 필요합니다.',
    );
  },

  messageBodyTooLong() {
    return badRequestError('CHAT_MESSAGE_BODY_TOO_LONG', '메시지는 1,000자 이하로 입력해주세요.');
  },

  messageIdempotencyConflict() {
    return conflictError(
      'CHAT_MESSAGE_IDEMPOTENCY_CONFLICT',
      '같은 메시지 식별자로 다른 본문을 보낼 수 없습니다.',
    );
  },

  readMarkerCannotMoveBackward() {
    return conflictError(
      'CHAT_READ_MARKER_CANNOT_MOVE_BACKWARD',
      '읽음 위치는 이전 메시지로 되돌릴 수 없습니다.',
    );
  },

  threadLeaveNotAllowed() {
    return conflictError(
      'CHAT_THREAD_LEAVE_NOT_ALLOWED',
      '현재 상태에서는 이 채팅에서 나갈 수 없습니다.',
    );
  },

  invalidThreadListCursor() {
    return badRequestError(
      'CHAT_THREAD_LIST_CURSOR_INVALID',
      '채팅 목록 cursor가 만료되었거나 올바르지 않습니다.',
    );
  },
};
