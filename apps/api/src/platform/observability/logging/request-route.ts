export type RequestRouteShape = {
  baseUrl?: unknown;
  route?: {
    path?: unknown;
  };
};

function normalizeRoutePath(path: string): string {
  if (!path || path === '/') {
    return '';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function resolveRequestRouteTemplate(request: RequestRouteShape): string {
  const routePath = request.route?.path;
  const selectedRoutePath = Array.isArray(routePath)
    ? routePath.find((path): path is string => typeof path === 'string')
    : typeof routePath === 'string'
      ? routePath
      : null;

  if (!selectedRoutePath) {
    return 'UNKNOWN_ROUTE';
  }

  const baseUrl = normalizeRoutePath(typeof request.baseUrl === 'string' ? request.baseUrl : '');
  const normalizedRoutePath = normalizeRoutePath(selectedRoutePath);
  const resolved = `${baseUrl}${normalizedRoutePath}` || '/';

  return resolved.replace(/\/+/g, '/');
}
