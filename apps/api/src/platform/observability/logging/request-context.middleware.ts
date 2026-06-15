import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service.js';

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function resolveSafeCorrelationId(value: unknown): string | null {
  if (Array.isArray(value)) {
    return resolveSafeCorrelationId(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return SAFE_CORRELATION_ID_PATTERN.test(trimmed) ? trimmed : null;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = resolveSafeCorrelationId(request.headers[REQUEST_ID_HEADER]) ?? randomUUID();
    const correlationId =
      resolveSafeCorrelationId(request.headers[CORRELATION_ID_HEADER]) ?? requestId;

    response.setHeader('X-Request-Id', requestId);

    this.requestContext.run(
      {
        correlationId,
        requestId,
      },
      next,
    );
  }
}
