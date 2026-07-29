import type { RequestJsonResult } from './auth-api.types';
import { SERVER_ERROR_MESSAGE } from './error-mapper';

export async function requestJson<T>(
  path: string,
  init: RequestInit,
): Promise<RequestJsonResult<T>> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {
      success: false,
      code: 'BFF_RESPONSE_INVALID',
      error: SERVER_ERROR_MESSAGE,
      userActionable: true,
    } as T;
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const { data } = await requestJson<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return data;
}

export function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return Math.ceil(numberValue);
}
