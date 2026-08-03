import { serviceUnavailableError, tooManyRequestsError } from '../../platform/http/api-error.js';
import { AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE } from '@repo/shared/auth/response';

export const authErrors = {
  passwordHashCapacityUnavailable(retryAfterSeconds: number) {
    return serviceUnavailableError(
      AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE,
      '비밀번호 처리가 잠시 지연되고 있어요.',
      { retryAfterSeconds },
    );
  },

  codeRequestThrottled(retryAfterSeconds: number) {
    return tooManyRequestsError(
      'AUTH_CODE_REQUEST_THROTTLED',
      `너무 잦은 요청이에요. ${retryAfterSeconds}초 후 다시 시도해주세요.`,
      { retryAfterSeconds },
    );
  },

  signupSubmissionThrottled(retryAfterSeconds: number) {
    return tooManyRequestsError(
      'AUTH_SIGNUP_SUBMISSION_THROTTLED',
      '가입 요청이 잠시 제한됐어요.',
      { retryAfterSeconds },
    );
  },

  changePasswordThrottled(retryAfterSeconds: number) {
    return tooManyRequestsError(
      'AUTH_CHANGE_PASSWORD_THROTTLED',
      '비밀번호 변경이 잠시 제한됐어요.',
      { retryAfterSeconds },
    );
  },
};
