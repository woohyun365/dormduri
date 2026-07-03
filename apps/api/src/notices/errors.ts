import { badRequestError, notFoundError } from '../platform/http/api-error.js';

export const noticeErrors = {
  invalidListCursor() {
    return badRequestError(
      'GLOBAL_NOTICE_LIST_CURSOR_INVALID',
      '공지사항 목록 커서가 올바르지 않습니다.',
    );
  },
  notFound() {
    return notFoundError('GLOBAL_NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');
  },
} as const;
