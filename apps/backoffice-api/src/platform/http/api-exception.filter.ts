import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import type { BackofficeErrorCode } from '@repo/shared/backoffice';
import type { BackofficeLogger } from '../observability/backoffice-logger.js';
import { BackofficeApiError, statusForErrorCode } from './api-error.js';
import { resolveRequestId, type BackofficeRequest } from './request-context.js';

function codeForHttpStatus(status: number): BackofficeErrorCode {
  if (status === 404) {
    return 'not_found';
  }
  if (status === 413 || (status >= 400 && status < 500)) {
    return 'invalid_request';
  }
  return 'internal_error';
}

/** Every error leaves as `{ error: { code, requestId } }` with `Cache-Control: no-store`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: BackofficeLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<BackofficeRequest>();
    const response = http.getResponse<ServerResponse>();
    const requestId = resolveRequestId(request);
    let code: BackofficeErrorCode;
    if (exception instanceof BackofficeApiError) {
      code = exception.code;
    } else if (exception instanceof HttpException) {
      code = codeForHttpStatus(exception.getStatus());
    } else {
      code = 'internal_error';
    }
    const status = statusForErrorCode(code);
    if (status >= 500) {
      this.logger.event('error', 'backoffice_request_failed', {
        requestId,
        errorName: exception instanceof Error ? exception.name : 'UnknownError',
      });
    }
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ error: { code, requestId } }));
  }
}
