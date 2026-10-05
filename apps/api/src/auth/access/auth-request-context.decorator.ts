import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthRequestContext } from '../domain/auth-request-context.js';

export interface AuthHttpRequestMetadata {
  headers: { 'user-agent'?: string | string[] };
  ip?: string;
  get?: (name: 'user-agent') => string | undefined;
}

export function resolveAuthRequestContext(request: AuthHttpRequestMetadata): AuthRequestContext {
  const headerUserAgent = request.headers['user-agent'];

  return {
    requestIp: request.ip ?? null,
    userAgent:
      typeof request.get === 'function'
        ? (request.get('user-agent') ?? null)
        : typeof headerUserAgent === 'string'
          ? headerUserAgent
          : null,
  };
}

export const AuthRequestMetadata = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthRequestContext =>
    resolveAuthRequestContext(context.switchToHttp().getRequest<AuthHttpRequestMetadata>()),
);
