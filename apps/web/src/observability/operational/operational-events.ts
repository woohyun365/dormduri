export const OPERATIONAL_EVENT_SCHEMA_VERSION = 1 as const;

export const OPERATIONAL_ROUTE_GROUPS = [
  'landing',
  'login',
  'signup',
  'password_reset',
  'main_home',
  'main_roommate',
  'main_matching',
  'main_chat',
  'other',
] as const;

export const OPERATIONAL_DEVICE_CLASSES = ['mobile', 'tablet', 'desktop'] as const;
export const OPERATIONAL_ENVIRONMENTS = ['local', 'preview', 'production'] as const;

export type OperationalRouteGroup = (typeof OPERATIONAL_ROUTE_GROUPS)[number];
export type OperationalDeviceClass = (typeof OPERATIONAL_DEVICE_CLASSES)[number];
export type OperationalEnvironment = (typeof OPERATIONAL_ENVIRONMENTS)[number];

export type OperationalEventEnvelope = Readonly<{
  schemaVersion: typeof OPERATIONAL_EVENT_SCHEMA_VERSION;
  occurredAt: string;
  environment: OperationalEnvironment;
  release: string;
  routeGroup: OperationalRouteGroup;
  deviceClass: OperationalDeviceClass;
}>;

export type WebRuntimeErrorEvent = OperationalEventEnvelope &
  Readonly<{
    eventName: 'web_runtime_error';
    source: 'route_boundary' | 'global_boundary' | 'window_error' | 'unhandled_rejection';
    severity: 'fatal' | 'error';
    errorType: string;
    fingerprint: string;
    digestPresent: boolean;
    handled: boolean;
    recoveryAction: 'retry' | 'reload' | 'navigate_home' | 'none';
    recoveryOutcome: 'succeeded' | 'failed' | 'abandoned' | 'unknown';
  }>;

export type WebBffRequestCompletedEvent = OperationalEventEnvelope &
  Readonly<{
    eventName: 'web_bff_request_completed';
    operation: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    outcome:
      | 'success'
      | 'client_error'
      | 'upstream_error'
      | 'timeout'
      | 'network'
      | 'aborted'
      | 'invalid_response'
      | 'invalid_config';
    statusClass: '2xx' | '4xx' | '5xx' | 'none';
    durationMs: number;
    authenticated: boolean;
    requestCorrelationPresent: boolean;
    requestId?: string;
  }>;

export type WebVitalMeasuredEvent = OperationalEventEnvelope &
  Readonly<{
    eventName: 'web_vital_measured';
    metric: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
    value: number;
    delta?: number;
    rating?: string;
    navigationType?: string;
    metricId: string;
    attributionKeys: readonly string[];
  }>;

export type OperationalEvent =
  | WebRuntimeErrorEvent
  | WebBffRequestCompletedEvent
  | WebVitalMeasuredEvent;

export const OPERATIONAL_EVENT_NAMES = [
  'web_runtime_error',
  'web_bff_request_completed',
  'web_vital_measured',
] as const satisfies readonly OperationalEvent['eventName'][];

export const OPERATIONAL_FORBIDDEN_KEY_PARTS = [
  'email',
  'nickname',
  'password',
  'verificationcode',
  'proof',
  'grant',
  'token',
  'authorization',
  'cookie',
  'setcookie',
  'ip',
  'forwardedfor',
  'useragent',
  'body',
  'intro',
  'profile',
  'chat',
  'userid',
  'sessionid',
] as const;
