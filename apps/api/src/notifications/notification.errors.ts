import { badRequestError, notFoundError } from '../common/http/api-error.js';

export const notificationErrors = {
  invalidListCursor() {
    return badRequestError(
      'NOTIFICATION_LIST_CURSOR_INVALID',
      '알림 목록 커서가 올바르지 않습니다.',
    );
  },

  notificationNotFound() {
    return notFoundError('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다.');
  },
};
