import { InternalServerErrorException } from '@nestjs/common';
import {
  badRequestError,
  conflictError,
  createApiErrorBody,
  unprocessableEntityError,
} from '../common/http/api-error.js';

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

  nicknameAlreadyTaken() {
    return conflictError(
      'NICKNAME_ALREADY_TAKEN',
      '이미 사용 중인 닉네임입니다.',
      fieldErrors('nickname', '이미 사용 중인 닉네임입니다.'),
    );
  },

  nicknameModerationRejected(message: string) {
    return unprocessableEntityError(
      'NICKNAME_MODERATION_REJECTED',
      message,
      fieldErrors('nickname', message),
    );
  },

  accountIdentityIncomplete(surface: 'current-user') {
    return new InternalServerErrorException(
      createApiErrorBody('ACCOUNT_IDENTITY_INCOMPLETE', '계정 표시 identity가 누락되었습니다.', {
        invariant: 'USER_DISPLAY_IDENTITY_REQUIRED',
        surface,
      }),
    );
  },
};
