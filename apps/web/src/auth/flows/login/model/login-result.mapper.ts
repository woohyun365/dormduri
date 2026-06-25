import type { LoginResponse } from '@repo/shared/auth/response';
import type { LoginUiErrorState } from './login-form.types';

const DEFAULT_INVALID_LOGIN_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';
const DEFAULT_LOCKED_LOGIN_MESSAGE = '계정이 일시적으로 잠겼습니다.';
const DEFAULT_THROTTLED_LOGIN_MESSAGE = '너무 잦은 요청이에요. 잠시 후 다시 시도해주세요.';
export const LOGIN_NETWORK_ERROR_MESSAGE =
  '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
export const LOGIN_SERVER_ERROR_MESSAGE =
  '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';

function isPositiveSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isServerSafeLoginCode(code: unknown): boolean {
  return (
    code === 'INVALID_LOGIN_REQUEST' ||
    code === 'BFF_RESPONSE_INVALID' ||
    (typeof code === 'string' && code.startsWith('BFF_UPSTREAM_'))
  );
}

export function mapLoginResponseToErrorState(
  response: LoginResponse,
  submittedEmail: string,
): LoginUiErrorState | null {
  if (response.success) return null;

  if (response.locked === true && isPositiveSeconds(response.remainingSeconds)) {
    return {
      status: 'locked',
      message: response.error ?? DEFAULT_LOCKED_LOGIN_MESSAGE,
      lockedEmail: submittedEmail,
      remainingSeconds: Math.ceil(response.remainingSeconds),
    };
  }

  if (isPositiveSeconds(response.retryAfterSeconds)) {
    return {
      status: 'throttled',
      message: response.error ?? DEFAULT_THROTTLED_LOGIN_MESSAGE,
      retryAfterSeconds: Math.ceil(response.retryAfterSeconds),
    };
  }

  if (isServerSafeLoginCode(response.code)) {
    return {
      status: 'server-error',
      message: LOGIN_SERVER_ERROR_MESSAGE,
    };
  }

  return {
    status: 'invalid',
    message: response.error ?? DEFAULT_INVALID_LOGIN_MESSAGE,
  };
}

export function mapLoginThrownErrorToErrorState(): LoginUiErrorState {
  return {
    status: 'network-error',
    message: LOGIN_NETWORK_ERROR_MESSAGE,
  };
}
