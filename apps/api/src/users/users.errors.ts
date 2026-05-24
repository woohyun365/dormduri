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

  nicknameModerationRejected(message: string) {
    return unprocessableEntityError(
      'NICKNAME_MODERATION_REJECTED',
      message,
      fieldErrors('nickname', message),
    );
  },

  dormitoryAlreadyConfirmed() {
    return conflictError(
      'DORMITORY_ALREADY_CONFIRMED',
      '이미 확정된 건물은 사용자 API로 변경할 수 없습니다.',
    );
  },

  dormitorySelectionNotAllowed() {
    return conflictError(
      'DORMITORY_SELECTION_NOT_ALLOWED',
      '현재 상태에서는 건물 선택을 변경할 수 없습니다.',
    );
  },

  dormitorySelectionRequiresParticipation() {
    return conflictError(
      'SEASON_PARTICIPATION_REQUIRED',
      '시즌 참여자 등록을 완료한 뒤에만 건물 선택을 진행할 수 있습니다.',
    );
  },

  invalidDormitoryForUser(message: string = '현재 사용자 상태에 맞지 않는 기숙사입니다.') {
    return unprocessableEntityError(
      'INVALID_DORMITORY_FOR_USER',
      message,
      fieldErrors('selection.dormitoryId', message),
    );
  },

  profileFieldLocked(field: 'intro' | 'messageToRoommate' | 'additional', message: string) {
    return conflictError('PROFILE_TEXT_EDIT_LOCKED', message, fieldErrors(field, message));
  },

  textModerationRejected(field: 'intro' | 'messageToRoommate', message: string) {
    return unprocessableEntityError(
      'TEXT_MODERATION_REJECTED',
      message,
      fieldErrors(field, message),
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
