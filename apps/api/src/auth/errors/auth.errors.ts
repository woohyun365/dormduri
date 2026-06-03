import { tooManyRequestsError } from '../../common/http/api-error.js';

export const authErrors = {
  codeRequestThrottled(retryAfterSeconds: number) {
    return tooManyRequestsError(
      'AUTH_CODE_REQUEST_THROTTLED',
      `너무 잦은 요청이에요. ${retryAfterSeconds}초 후 다시 시도해주세요.`,
      { retryAfterSeconds },
    );
  },
};
