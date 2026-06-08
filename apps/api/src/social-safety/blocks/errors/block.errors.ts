import { badRequestError, conflictError, notFoundError } from '../../../platform/http/api-error.js';

export const blockErrors = {
  invalidBlockTarget() {
    return badRequestError('INVALID_BLOCK_TARGET', '차단 대상이 올바르지 않습니다.');
  },

  invalidBlockQuery() {
    return badRequestError('INVALID_BLOCK_QUERY', '차단 목록 요청이 올바르지 않습니다.');
  },

  targetNotBlockable() {
    return notFoundError('TARGET_NOT_BLOCKABLE', '차단할 수 없는 대상입니다.');
  },

  activeMatchBlockNotAllowed() {
    return conflictError(
      'ACTIVE_MATCH_BLOCK_NOT_ALLOWED',
      '매칭이 성사된 상대는 차단할 수 없습니다. 신고 또는 고객지원으로 문의해주세요.',
      {
        actionHints: ['REPORT', 'SUPPORT'],
      },
    );
  },
};
