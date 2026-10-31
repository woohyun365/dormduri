import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

export const UNKNOWN_ROUTE = 'UNKNOWN_ROUTE';

// Nest's PATH_METADATA key for @Controller() and route decorator paths. Production code does
// not import @nestjs/common subpaths (module boundary); request-route.spec.ts pins the value.
export const NEST_PATH_METADATA = 'path';

// Per-request slot for the template a guard resolved, read by the exception filter for
// requests that end before the interceptors run (guard and throttle rejections).
const RECORDED_ROUTE_TEMPLATE = Symbol('apiRouteTemplate');

type RouteTemplateCarrier = { [RECORDED_ROUTE_TEMPLATE]?: unknown };

function normalizeRoutePath(path: string): string {
  if (!path || path === '/') {
    return '';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function selectRoutePath(path: unknown): string | null {
  if (Array.isArray(path)) {
    return path.find((item): item is string => typeof item === 'string') ?? null;
  }
  return typeof path === 'string' ? path : null;
}

/**
 * Joins the controller and handler path metadata the way Nest registers the route (one leading
 * slash, no trailing slash). The API uses no global prefix, versioning or RouterModule paths, so
 * the two paths are the whole route template.
 */
export function resolveRouteTemplate(controllerPath: unknown, handlerPath: unknown): string {
  const selectedHandlerPath = selectRoutePath(handlerPath);
  if (selectedHandlerPath === null) {
    return UNKNOWN_ROUTE;
  }

  const controller = normalizeRoutePath(selectRoutePath(controllerPath) ?? '');
  const resolved = `${controller}${normalizeRoutePath(selectedHandlerPath)}` || '/';

  const collapsed = resolved.replace(/\/+/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

export function resolveExecutionRouteTemplate(
  context: Pick<ExecutionContext, 'getClass' | 'getHandler'>,
  reflector: Pick<Reflector, 'get'>,
): string {
  return resolveRouteTemplate(
    reflector.get<unknown>(NEST_PATH_METADATA, context.getClass()),
    reflector.get<unknown>(NEST_PATH_METADATA, context.getHandler()),
  );
}

export function recordRequestRouteTemplate(request: object, template: string): void {
  (request as RouteTemplateCarrier)[RECORDED_ROUTE_TEMPLATE] = template;
}

export function readRecordedRequestRouteTemplate(request: unknown): string {
  if (typeof request !== 'object' || request === null) {
    return UNKNOWN_ROUTE;
  }
  const template = (request as RouteTemplateCarrier)[RECORDED_ROUTE_TEMPLATE];
  return typeof template === 'string' ? template : UNKNOWN_ROUTE;
}
