import { badRequestError, conflictError, notFoundError } from '../platform/http/api-error.js';

export const seasonsErrors = {
  currentSeasonNotFound() {
    return notFoundError('SEASONS_CURRENT_NOT_FOUND', '현재 조회 가능한 시즌 정보가 없습니다.');
  },
  seasonNotFound() {
    return notFoundError('SEASONS_OPERATION_NOT_FOUND', '수정할 시즌 정보를 찾을 수 없습니다.');
  },
  operationConflict() {
    return conflictError(
      'SEASONS_OPERATION_CONFLICT',
      '시즌 정보가 이미 변경되었습니다. 최신 상태를 다시 확인해 주세요.',
    );
  },
  invalidOperationRequest(code: string, error: string) {
    return badRequestError(code, error);
  },
};
