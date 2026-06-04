import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
  UnauthorizedException,
} from '@nestjs/common';

export interface ApiErrorBody {
  success: false;
  error: string;
  code: string;
  [key: string]: unknown;
}

type ApiErrorExtras = Record<string, unknown>;

export function createApiErrorBody(
  code: string,
  error: string,
  extras: ApiErrorExtras = {},
): ApiErrorBody {
  return {
    success: false,
    error,
    code,
    ...extras,
  };
}

export function badRequestError(code: string, error: string, extras?: ApiErrorExtras) {
  return new BadRequestException(createApiErrorBody(code, error, extras));
}

export function unauthorizedError(code: string, error: string, extras?: ApiErrorExtras) {
  return new UnauthorizedException(createApiErrorBody(code, error, extras));
}

export function forbiddenError(code: string, error: string, extras?: ApiErrorExtras) {
  return new ForbiddenException(createApiErrorBody(code, error, extras));
}

export function notFoundError(code: string, error: string, extras?: ApiErrorExtras) {
  return new NotFoundException(createApiErrorBody(code, error, extras));
}

export function conflictError(code: string, error: string, extras?: ApiErrorExtras) {
  return new ConflictException(createApiErrorBody(code, error, extras));
}

export function unprocessableEntityError(code: string, error: string, extras?: ApiErrorExtras) {
  return new UnprocessableEntityException(createApiErrorBody(code, error, extras));
}

export function tooManyRequestsError(code: string, error: string, extras?: ApiErrorExtras) {
  return new HttpException(createApiErrorBody(code, error, extras), HttpStatus.TOO_MANY_REQUESTS);
}

interface NormalizedApiError {
  code: string;
  error: string;
  extras: ApiErrorExtras;
  stack?: string;
  statusCode: number;
}

export function normalizeApiError(exception: unknown): NormalizedApiError {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        statusCode,
        code: defaultErrorCode(statusCode),
        error: response,
        extras: {},
        stack: exception.stack,
      };
    }

    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      const error =
        body.success === false && typeof body.error === 'string'
          ? body.error
          : typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? body.message.join(', ')
              : typeof body.error === 'string'
                ? body.error
                : defaultErrorMessage(statusCode);

      const code =
        typeof body.code === 'string' && body.code.length > 0
          ? body.code
          : defaultErrorCode(statusCode);

      const extras = Object.fromEntries(
        Object.entries(body).filter(
          ([key]) => !['success', 'error', 'message', 'statusCode', 'code'].includes(key),
        ),
      );

      return {
        statusCode,
        code,
        error,
        extras,
        stack: exception.stack,
      };
    }
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    error: defaultErrorMessage(HttpStatus.INTERNAL_SERVER_ERROR),
    extras: {},
    stack: exception instanceof Error ? exception.stack : undefined,
  };
}

function defaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : `HTTP_${statusCode}`;
  }
}

function defaultErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return '요청 값이 올바르지 않습니다.';
    case 401:
      return '로그인이 필요합니다.';
    case 403:
      return '요청을 수행할 권한이 없습니다.';
    case 404:
      return '요청한 정보를 찾을 수 없습니다.';
    case 429:
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    default:
      return '일시적인 서버 오류가 발생했습니다.';
  }
}
