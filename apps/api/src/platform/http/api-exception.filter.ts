import { Catch, type ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { normalizeApiError } from './api-error.js';
import { AppLoggerService } from '../observability/logging/app-logger.service.js';
import { mapExceptionToLogEvent } from '../observability/logging/exception-log.mapper.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

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

    this.logException(request, normalized);
    response.status(normalized.statusCode).json(body);
  }

  private logException(request: Request, normalized: ReturnType<typeof normalizeApiError>) {
    const { event, level, message } = mapExceptionToLogEvent(request, normalized);
    try {
      this.logger.write(level, event, message);
    } catch {
      // Logging must never affect product error responses.
    }
  }
}
