import type { Request } from 'express';

export interface AuthRequestContext {
  requestIp?: string | null;
  userAgent?: string | null;
}

export function resolveAuthRequestContext(request: Request): AuthRequestContext {
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

export function normalizeAuthRequestContext(
  requestIpOrContext?: string | null | AuthRequestContext,
  userAgent?: string | null,
): AuthRequestContext {
  if (
    typeof requestIpOrContext === 'object' &&
    requestIpOrContext !== null &&
    ('requestIp' in requestIpOrContext || 'userAgent' in requestIpOrContext)
  ) {
    return {
      requestIp: requestIpOrContext.requestIp ?? null,
      userAgent: requestIpOrContext.userAgent ?? null,
    };
  }

  return {
    requestIp: typeof requestIpOrContext === 'string' ? requestIpOrContext : null,
    userAgent: userAgent ?? null,
  };
}

export function hasAuthRequestContext(context: AuthRequestContext | undefined): boolean {
  return Boolean(context?.requestIp || context?.userAgent);
}
