import {
  badRequestError,
  conflictError,
  notFoundError,
  unprocessableEntityError,
} from '../common/http/api-error.js';

function fieldErrors(field: string, message: string) {
  return {
    fieldErrors: {
      [field]: [message],
    },
  };
}

export const profilesErrors = {
  invalidProfileQuery(message: string = '지원하지 않는 프로필 조회 쿼리입니다.') {
    return badRequestError('INVALID_PROFILE_QUERY', message);
  },

  profileNotVisible() {
    return notFoundError('PROFILE_NOT_VISIBLE', '조회할 수 없는 프로필입니다.');
  },

  profileEditLocked() {
    return conflictError(
      'PROFILE_EDIT_LOCKED',
      '현재 시즌 상태에서는 생활패턴을 수정할 수 없습니다.',
    );
  },

  nicknameEditLocked() {
    return conflictError(
      'NICKNAME_EDIT_LOCKED',
      '현재 시즌 구간에서는 닉네임을 변경할 수 없습니다.',
    );
  },

  nicknameCooldownActive() {
    return conflictError(
      'NICKNAME_COOLDOWN_ACTIVE',
      '닉네임은 시즌 외 기간에 30일마다 한 번만 변경할 수 있습니다.',
    );
  },

  nicknameAlreadyTaken() {
    return conflictError(
      'NICKNAME_ALREADY_TAKEN',
      '이미 사용 중인 닉네임입니다.',
      fieldErrors('nickname', '이미 사용 중인 닉네임입니다.'),
    );
  },

  invalidNickname(message: string) {
    return badRequestError('INVALID_NICKNAME', message, fieldErrors('nickname', message));
  },

  nicknameModerationRejected(message: string) {
    return unprocessableEntityError(
      'NICKNAME_MODERATION_REJECTED',
      message,
      fieldErrors('nickname', message),
    );
  },

  invalidLifestyle(message: string) {
    return badRequestError('INVALID_LIFESTYLE_PAYLOAD', message, fieldErrors('lifestyle', message));
  },
};
