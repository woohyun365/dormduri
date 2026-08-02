import { usersErrors } from '../../errors/users.errors.js';
import {
  DisplayIdentityNicknamePolicyError,
  type DisplayIdentityNicknamePolicyService,
  type ParsedDisplayIdentityNickname,
} from './display-identity-nickname-policy.service.js';

export function parseDisplayIdentityNicknameForUser(
  policy: DisplayIdentityNicknamePolicyService,
  nickname: string,
): ParsedDisplayIdentityNickname {
  try {
    return policy.parse(nickname);
  } catch (error) {
    throwUserNicknamePolicyError(error);
  }
}

export async function applyDisplayIdentityNicknamePolicyForUser(
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    throwUserNicknamePolicyError(error);
  }
}

function throwUserNicknamePolicyError(error: unknown): never {
  if (!(error instanceof DisplayIdentityNicknamePolicyError)) {
    throw error;
  }

  switch (error.reason) {
    case 'INVALID_FORMAT':
      throw usersErrors.invalidNickname(error.message);
    case 'MODERATION_REJECTED':
      throw usersErrors.nicknameModerationRejected(error.message);
    case 'ALREADY_TAKEN':
      throw usersErrors.nicknameAlreadyTaken();
  }
}
