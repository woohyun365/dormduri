import { badRequestError, notFoundError } from '../common/http/api-error.js';

export const seasonsErrors = {
  invalidCampusQuery() {
    return badRequestError(
      'SEASONS_INVALID_CAMPUS_QUERY',
      'campus 쿼리 파라미터 값이 올바르지 않습니다.',
    );
  },
  currentSeasonNotFound() {
    return notFoundError('SEASONS_CURRENT_NOT_FOUND', '현재 조회 가능한 시즌 정보가 없습니다.');
  },
};
