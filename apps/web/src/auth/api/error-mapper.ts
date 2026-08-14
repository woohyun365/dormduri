import type { AuthClientErrorBody } from './auth-api.types';

export const SERVER_ERROR_MESSAGE = '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';

export function resolveRetryAfterSeconds(
  data: { retryAfterSeconds?: number },
  retryAfterSeconds?: number,
): number | undefined {
  const seconds =
    typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : retryAfterSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return Math.ceil(seconds);
}

export function mapAuthRequestError(
  status: number,
  data: AuthClientErrorBody,
  retryAfterSeconds?: number,
): string {
  if (status === 429) {
    const seconds = resolveRetryAfterSeconds(data, retryAfterSeconds);
    if (typeof seconds === 'number') {
      return `너무 잦은 요청이에요. ${seconds}초 후 다시 시도해주세요.`;
    }
    return '너무 잦은 요청이에요. 잠시 후 다시 시도해주세요.';
  }
  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }
  return data.error ?? data.message ?? '요청 처리에 실패했어요.';
}

export function isSafeAuthInfrastructureError(
  status: number,
  data: Pick<AuthClientErrorBody, 'code'>,
): boolean {
  return (
    status >= 500 ||
    data.code === 'BFF_RESPONSE_INVALID' ||
    data.code?.startsWith('BFF_UPSTREAM_') === true
  );
}

function isSafeLoginServerError(status: number, data: Pick<AuthClientErrorBody, 'code'>): boolean {
  return isSafeAuthInfrastructureError(status, data) || data.code === 'INVALID_LOGIN_REQUEST';
}

export function mapLoginError(
  status: number,
  data: AuthClientErrorBody,
  retryAfterSeconds?: number,
): string {
  if (isSafeLoginServerError(status, data)) {
    return SERVER_ERROR_MESSAGE;
  }

  return mapAuthRequestError(status, data, retryAfterSeconds);
}
