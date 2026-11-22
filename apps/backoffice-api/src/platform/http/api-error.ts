import type { BackofficeErrorCode } from '@repo/shared/backoffice';

const STATUS_BY_CODE: Record<BackofficeErrorCode, number> = {
  invalid_request: 400,
  authentication_failed: 401,
  session_required: 401,
  session_expired: 401,
  recovery_scope: 403,
  reauthentication_required: 403,
  permission_denied: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
};

/**
 * Error the backoffice API returns as `{ error: { code } }`. The code is the only contract; the
 * message is for logs and never carries account data, codes or tokens.
 */
export class BackofficeApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: BackofficeErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'BackofficeApiError';
    this.status = STATUS_BY_CODE[code];
  }
}

export function statusForErrorCode(code: BackofficeErrorCode): number {
  return STATUS_BY_CODE[code];
}
