import { conflictError } from '../common/http/api-error.js';

export const seasonParticipantsErrors = {
  registrationNotAllowed() {
    return conflictError(
      'SEASON_PARTICIPATION_REGISTRATION_NOT_ALLOWED',
      '현재 상태에서는 시즌 참여자 등록을 완료할 수 없습니다.',
    );
  },

  registrationSeasonProfileIncomplete() {
    return conflictError(
      'SEASON_PARTICIPATION_PROFILE_INCOMPLETE',
      '수면/생활 패턴과 원하는 룸메 조건을 모두 입력한 뒤 시즌 참여자 등록을 완료할 수 있습니다.',
    );
  },

  deregistrationNotAllowed() {
    return conflictError(
      'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED',
      '현재 상태에서는 시즌 참여 철회를 진행할 수 없습니다.',
    );
  },
};
