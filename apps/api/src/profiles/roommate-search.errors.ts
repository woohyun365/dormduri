import { badRequestError } from '../platform/http/api-error.js';

export const roommateSearchErrors = {
  invalidQuery(message: string = '룸메이트 찾기 검색 조건이 올바르지 않습니다.') {
    return badRequestError('INVALID_ROOMMATE_SEARCH_QUERY', message);
  },
};
