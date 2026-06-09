import {
  badRequestError,
  conflictError,
  unprocessableEntityError,
} from '../../platform/http/api-error.js';

function fieldErrors(field: string, message: string) {
  return {
    fieldErrors: {
      [field]: [message],
    },
  };
}

export const usersErrors = {
  invalidPatch(message: string, field: string) {
    return badRequestError('INVALID_USER_PATCH', message, fieldErrors(field, message));
  },
  invalidNickname(message: string) {
    return badRequestError('INVALID_NICKNAME', message, fieldErrors('nickname', message));
  },

  nicknameCooldownActive() {
    return conflictError(
      'NICKNAME_COOLDOWN_ACTIVE',
      '닉네임은 30일마다 한 번만 변경할 수 있습니다.',
    );
  },

  nicknameLockedBySeason() {
    return conflictError(
      'NICKNAME_LOCKED_BY_SEASON',
      '현재 시즌 등록 완료 후에는 시즌이 종료될 때까지 닉네임을 변경할 수 없습니다.',
    );
  },

  academicIdentityLockedByRegistration() {
    return conflictError(
      'ACADEMIC_IDENTITY_LOCKED_BY_REGISTRATION',
      '현재 시즌 등록 완료 후에는 학업 정보를 직접 변경할 수 없습니다.',
    );
  },

  academicBirthYearLockedAfterRegistration() {
    return conflictError(
      'ACADEMIC_BIRTH_YEAR_LOCKED_AFTER_REGISTRATION',
      '시즌 등록 이력이 있으면 출생연도는 직접 변경할 수 없습니다.',
    );
  },

  academicCollegeChangeAllowanceExhausted() {
    return conflictError(
      'ACADEMIC_COLLEGE_CHANGE_ALLOWANCE_EXHAUSTED',
      '이번 학사 주기의 단과대 정정 가능 횟수를 모두 사용했습니다.',
    );
  },

  academicCorrectionCycleUnavailable() {
    return conflictError(
      'ACADEMIC_CORRECTION_CYCLE_UNAVAILABLE',
      '현재 학사 주기를 확인할 수 없어 학업 정보를 변경할 수 없습니다.',
    );
  },

  nicknameAlreadyTaken() {
    return conflictError(
      'NICKNAME_ALREADY_TAKEN',
      '이미 사용 중인 닉네임입니다.',
      fieldErrors('nickname', '이미 사용 중인 닉네임입니다.'),
    );
  },

  accountAlreadyDeleted() {
    return conflictError('ACCOUNT_ALREADY_DELETED', '이미 삭제 처리된 계정입니다.');
  },

  nicknameModerationRejected(message: string) {
    return unprocessableEntityError(
      'NICKNAME_MODERATION_REJECTED',
      message,
      fieldErrors('nickname', message),
    );
  },
};
