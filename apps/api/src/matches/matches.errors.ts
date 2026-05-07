import {
  conflictError,
  notFoundError,
  unprocessableEntityError,
} from '../common/http/api-error.js';

function fieldErrors(field: string, message: string) {
  return {
    fieldErrors: {
      [field]: [message],
    },
  };
}

export const matchesErrors = {
  requestTargetNotFound() {
    return notFoundError('MATCH_REQUEST_TARGET_NOT_FOUND', '매칭 요청 대상을 찾을 수 없습니다.');
  },

  requestNotAllowed(message: string = '현재 상태에서는 매칭 요청을 생성할 수 없습니다.') {
    return conflictError('MATCH_REQUEST_NOT_ALLOWED', message);
  },

  requestSelfTargetNotAllowed() {
    return conflictError(
      'MATCH_REQUEST_SELF_TARGET_NOT_ALLOWED',
      '자기 자신에게는 매칭 요청을 보낼 수 없습니다.',
    );
  },

  requestAlreadyPending() {
    return conflictError(
      'MATCH_REQUEST_ALREADY_PENDING',
      '같은 상대에 대한 진행 중 요청이 이미 있습니다.',
    );
  },

  requestPendingLimitReached() {
    return conflictError(
      'MATCH_REQUEST_PENDING_LIMIT_REACHED',
      '동시에 보낼 수 있는 진행 중 요청 수를 초과했습니다.',
    );
  },

  requestDirectionLimitReached() {
    return conflictError(
      'MATCH_REQUEST_DIRECTION_LIMIT_REACHED',
      '이번 시즌 같은 방향 요청 횟수를 모두 사용했습니다.',
    );
  },

  requestDirectionCooldownActive() {
    return conflictError(
      'MATCH_REQUEST_DIRECTION_COOLDOWN_ACTIVE',
      '같은 방향 요청은 2일 뒤 다시 보낼 수 있습니다.',
    );
  },

  requestNoteModerationRejected(message: string) {
    return unprocessableEntityError(
      'MATCH_REQUEST_NOTE_MODERATION_REJECTED',
      message,
      fieldErrors('note', message),
    );
  },

  requestNotFound() {
    return notFoundError('MATCH_REQUEST_NOT_FOUND', '해당 매칭 요청을 찾을 수 없습니다.');
  },

  requestNotPending() {
    return conflictError('MATCH_REQUEST_NOT_PENDING', '이미 종료된 매칭 요청입니다.');
  },

  requestExpired() {
    return conflictError('MATCH_REQUEST_EXPIRED', '이미 만료된 매칭 요청입니다.');
  },

  requestAcceptNotAllowed() {
    return conflictError(
      'MATCH_REQUEST_ACCEPT_NOT_ALLOWED',
      '현재 사용자는 이 매칭 요청을 수락할 수 없습니다.',
    );
  },

  requestRejectNotAllowed() {
    return conflictError(
      'MATCH_REQUEST_REJECT_NOT_ALLOWED',
      '현재 사용자는 이 매칭 요청을 거절할 수 없습니다.',
    );
  },

  requestCancelNotAllowed() {
    return conflictError(
      'MATCH_REQUEST_CANCEL_NOT_ALLOWED',
      '현재 사용자는 이 매칭 요청을 취소할 수 없습니다.',
    );
  },

  activeMatchAlreadyExists() {
    return conflictError('ACTIVE_MATCH_ALREADY_EXISTS', '이미 확정된 매칭 관계가 존재합니다.');
  },

  activeMatchNotFound() {
    return notFoundError('ACTIVE_MATCH_NOT_FOUND', '현재 활성화된 매칭 관계를 찾을 수 없습니다.');
  },

  unmatchRequestNotAllowed(message: string = '현재 상태에서는 매칭 취소 요청을 보낼 수 없습니다.') {
    return conflictError('ACTIVE_MATCH_UNMATCH_REQUEST_NOT_ALLOWED', message);
  },

  unmatchRequestAlreadySubmitted() {
    return conflictError(
      'ACTIVE_MATCH_UNMATCH_REQUEST_ALREADY_SUBMITTED',
      '이미 매칭 취소 요청을 보냈습니다.',
    );
  },

  unmatchRequestCancelNotAllowed() {
    return conflictError(
      'ACTIVE_MATCH_UNMATCH_REQUEST_CANCEL_NOT_ALLOWED',
      '현재 상태에서는 매칭 취소 요청을 철회할 수 없습니다.',
    );
  },
};
