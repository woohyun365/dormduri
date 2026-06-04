import { notFoundError } from '../platform/http/api-error.js';

export const seasonsErrors = {
  currentSeasonNotFound() {
    return notFoundError('SEASONS_CURRENT_NOT_FOUND', '현재 조회 가능한 시즌 정보가 없습니다.');
  },
};
