import type { LoginResponse } from '@repo/shared/auth/response';
import { LOGIN_FEEDBACK_COPY } from './login-feedback.copy';
import type { LoginUiErrorState } from './login-form.types';

export const LOGIN_NETWORK_ERROR_MESSAGE = LOGIN_FEEDBACK_COPY.network;
export const LOGIN_SERVER_ERROR_MESSAGE = LOGIN_FEEDBACK_COPY.server;

function isPositiveSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isServerSafeLoginCode(code: unknown): boolean {
  return (
    code === 'INVALID_LOGIN_REQUEST' ||
    code === 'AUTH_SERVICE_UNAVAILABLE' ||
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
      message: LOGIN_FEEDBACK_COPY.locked,
      lockedEmail: submittedEmail,
      remainingSeconds: Math.ceil(response.remainingSeconds),
    };
  }

  if (isPositiveSeconds(response.retryAfterSeconds)) {
    return {
      status: 'throttled',
      message: LOGIN_FEEDBACK_COPY.throttled,
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
    message: LOGIN_FEEDBACK_COPY.invalidCredentials,
  };
}

export function mapLoginThrownErrorToErrorState(): LoginUiErrorState {
  return {
    status: 'network-error',
    message: LOGIN_NETWORK_ERROR_MESSAGE,
  };
}
