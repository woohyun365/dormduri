import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { BackofficeApiError } from './api-error.js';
import {
  resolveRequestId,
  type AdminRequestSession,
  type BackofficeRequest,
} from './request-context.js';

/** Session the global access guard resolved; a route without one never reaches the handler. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminRequestSession => {
    const request = context.switchToHttp().getRequest<BackofficeRequest>();
    if (!request.adminSession) {
      throw new BackofficeApiError('session_required');
    }
    return request.adminSession;
  },
);

export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  resolveRequestId(context.switchToHttp().getRequest<BackofficeRequest>()),
);
