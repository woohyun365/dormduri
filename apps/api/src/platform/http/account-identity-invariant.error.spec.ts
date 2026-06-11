import { accountIdentityIncompleteError } from './account-identity-invariant.error.js';

describe('accountIdentityIncompleteError', () => {
  it('기존 ACCOUNT_IDENTITY_INCOMPLETE response body를 유지한다', () => {
    const error = accountIdentityIncompleteError(
      'registration-finalize',
      'USER_ACADEMIC_IDENTITY_REQUIRED',
    );

    expect(error.getStatus()).toBe(500);
    expect(error.getResponse()).toEqual({
      success: false,
      error: '계정 identity가 누락되었습니다.',
      code: 'ACCOUNT_IDENTITY_INCOMPLETE',
      invariant: 'USER_ACADEMIC_IDENTITY_REQUIRED',
      surface: 'registration-finalize',
    });
  });
});
