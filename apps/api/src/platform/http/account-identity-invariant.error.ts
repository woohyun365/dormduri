import { InternalServerErrorException } from '@nestjs/common';
import type {
  AccountIdentityInvariantCode,
  AccountIdentityInvariantSurface,
} from '../../identity/account-identity-invariant.js';
import { createApiErrorBody } from './api-error.js';

export function accountIdentityIncompleteError(
  surface: AccountIdentityInvariantSurface,
  invariant: AccountIdentityInvariantCode = 'USER_DISPLAY_IDENTITY_REQUIRED',
) {
  return new InternalServerErrorException(
    createApiErrorBody('ACCOUNT_IDENTITY_INCOMPLETE', '계정 identity가 누락되었습니다.', {
      invariant,
      surface,
    }),
  );
}
