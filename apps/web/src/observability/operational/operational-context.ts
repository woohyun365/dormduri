import {
  OPERATIONAL_DEVICE_CLASSES,
  OPERATIONAL_ENVIRONMENTS,
  OPERATIONAL_EVENT_SCHEMA_VERSION,
  OPERATIONAL_ROUTE_GROUPS,
  type OperationalDeviceClass,
  type OperationalEnvironment,
  type OperationalEventEnvelope,
  type OperationalRouteGroup,
} from './operational-events';

export function resolveOperationalRouteGroup(pathname: string | undefined): OperationalRouteGroup {
  const normalizedPathname = pathname ? new URL(pathname, 'https://web.local').pathname : undefined;
  if (!normalizedPathname || normalizedPathname === '/') return 'landing';
  if (normalizedPathname === '/login' || normalizedPathname.startsWith('/login/')) return 'login';
  if (normalizedPathname === '/signup' || normalizedPathname.startsWith('/signup/'))
    return 'signup';
  if (
    normalizedPathname === '/password-reset' ||
    normalizedPathname.startsWith('/password-reset/')
  ) {
    return 'password_reset';
  }
  if (normalizedPathname.startsWith('/main/roommate')) return 'main_roommate';
  if (normalizedPathname.startsWith('/main/matching')) return 'main_matching';
  if (normalizedPathname.startsWith('/main/chat')) return 'main_chat';
  if (normalizedPathname === '/main' || normalizedPathname.startsWith('/main/')) return 'main_home';
  return 'other';
}

export function resolveOperationalDeviceClass(viewportWidth: number): OperationalDeviceClass {
  if (viewportWidth < 768) return 'mobile';
  if (viewportWidth < 1200) return 'tablet';
  return 'desktop';
}

export function resolveOperationalEnvironment(value: string | undefined): OperationalEnvironment {
  if (value === 'production') return 'production';
  if (value === 'preview') return 'preview';
  return 'local';
}

export function createOperationalEventEnvelope(
  input: {
    pathname?: string;
    viewportWidth?: number;
    environment?: string;
    release?: string;
    occurredAt?: string;
  } = {},
): OperationalEventEnvelope {
  const routeGroup = resolveOperationalRouteGroup(input.pathname);
  const deviceClass = resolveOperationalDeviceClass(input.viewportWidth ?? 1280);
  const environment = resolveOperationalEnvironment(input.environment);

  return {
    schemaVersion: OPERATIONAL_EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    environment,
    release: input.release?.trim() || 'development',
    routeGroup,
    deviceClass,
  };
}

export function isOperationalRouteGroup(value: unknown): value is OperationalRouteGroup {
  return OPERATIONAL_ROUTE_GROUPS.includes(value as OperationalRouteGroup);
}

export function isOperationalDeviceClass(value: unknown): value is OperationalDeviceClass {
  return OPERATIONAL_DEVICE_CLASSES.includes(value as OperationalDeviceClass);
}

export function isOperationalEnvironment(value: unknown): value is OperationalEnvironment {
  return OPERATIONAL_ENVIRONMENTS.includes(value as OperationalEnvironment);
}
