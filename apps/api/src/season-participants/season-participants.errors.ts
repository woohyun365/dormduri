import { conflictError } from '../common/http/api-error.js';

export const seasonParticipantsErrors = {
  seasonProfileDraftNotAllowed() {
    return conflictError(
      'SEASON_PROFILE_DRAFT_NOT_ALLOWED',
      '현재 상태에서는 시즌 프로필 draft를 작성하거나 수정할 수 없습니다.',
    );
  },

  registrationNotAllowed() {
    return conflictError(
      'SEASON_PARTICIPATION_REGISTRATION_NOT_ALLOWED',
      '현재 상태에서는 시즌 참여자 등록을 완료할 수 없습니다.',
    );
  },

  registrationSeasonProfileIncomplete() {
    return conflictError(
      'SEASON_PARTICIPATION_PROFILE_INCOMPLETE',
      '수면/생활 패턴, 원하는 룸메 조건, 자기소개를 모두 입력한 뒤 시즌 참여자 등록을 완료할 수 있습니다.',
    );
  },

  dormitorySelectionInvalid() {
    return conflictError(
      'DORMITORY_SELECTION_INVALID',
      '현재 시즌/캠퍼스/성별/호실 선택일 조건에 맞는 기숙사를 선택해야 합니다.',
    );
  },

  noSelectableDormitory() {
    return conflictError('NO_SELECTABLE_DORMITORY', '현재 선택 가능한 운영 기숙사가 없습니다.');
  },

  deregistrationNotAllowed() {
    return conflictError(
      'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED',
      '현재 상태에서는 시즌 참여 철회를 진행할 수 없습니다.',
    );
  },
};
