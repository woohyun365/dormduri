import { badRequestError, notFoundError } from '../common/http/api-error.js';

export const profilesErrors = {
  invalidProfileQuery(message: string = '지원하지 않는 프로필 조회 쿼리입니다.') {
    return badRequestError('INVALID_PROFILE_QUERY', message);
  },

  profileNotVisible() {
    return notFoundError('PROFILE_NOT_VISIBLE', '조회할 수 없는 프로필입니다.');
  },
};
