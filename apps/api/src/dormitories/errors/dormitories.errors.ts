import { notFoundError } from '../../platform/http/api-error.js';

export const dormitoriesErrors = {
  campusNotFound() {
    return notFoundError('DORMITORIES_CAMPUS_NOT_FOUND', '요청한 캠퍼스 정보를 찾을 수 없습니다.');
  },

  dormitoryNotFound() {
    return notFoundError(
      'DORMITORIES_DORMITORY_NOT_FOUND',
      '요청한 기숙사 정보를 찾을 수 없습니다.',
    );
  },
};
