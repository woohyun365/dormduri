import { badRequestError, notFoundError } from '../../../platform/http/api-error.js';

export const bookmarkErrors = {
  invalidBookmarkTarget() {
    return badRequestError('INVALID_BOOKMARK_TARGET', '북마크 대상이 올바르지 않습니다.');
  },

  invalidBookmarkQuery() {
    return badRequestError('INVALID_BOOKMARK_QUERY', '북마크 목록 요청이 올바르지 않습니다.');
  },

  targetNotBookmarkable() {
    return notFoundError('TARGET_NOT_BOOKMARKABLE', '북마크할 수 없는 대상입니다.');
  },
};
