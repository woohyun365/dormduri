import { conflictError } from '../common/http/api-error.js';

export const seasonParticipantsErrors = {
  registrationNotAllowed() {
    return conflictError(
      'SEASON_PARTICIPATION_REGISTRATION_NOT_ALLOWED',
      '현재 상태에서는 시즌 참여자 등록을 완료할 수 없습니다.',
    );
  },
};
