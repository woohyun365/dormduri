import { Catch, type ArgumentsHost, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { normalizeApiError } from './api-error.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const normalized = normalizeApiError(exception);
    const path = request.originalUrl ?? request.url;

    const body = {
      success: false as const,
      error: normalized.error,
      code: normalized.code,
      statusCode: normalized.statusCode,
      timestamp: new Date().toISOString(),
      path,
      ...normalized.extras,
    };

    this.logException(
      request,
      normalized.statusCode,
      normalized.code,
      normalized.error,
      normalized.stack,
    );
    response.status(normalized.statusCode).json(body);
  }

  private logException(
    request: Request,
    statusCode: number,
    code: string,
    error: string,
    stack?: string,
  ) {
    const summary = JSON.stringify({
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode,
      code,
      error,
    });

    if (statusCode >= 500) {
      this.logger.error(summary, stack);
      return;
    }

    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      this.logger.warn(summary);
      return;
    }

    this.logger.log(summary);
  }
}
