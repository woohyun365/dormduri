export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppLogStatusClass = '2xx' | '3xx' | '4xx' | '5xx';

export interface AppLogEvent {
  actorHash?: string;
  context?: string;
  correlationId?: string;
  domain?: string;
  durationMs?: number;
  errorCode?: string;
  errorName?: string;
  method?: string;
  operation?: string;
  outcome?: string;
  requestId?: string;
  retryAttempt?: number;
  route?: string;
  statusClass?: AppLogStatusClass;
  statusCode?: number;
}

export function statusClassFromStatusCode(statusCode: number): AppLogStatusClass {
  if (statusCode >= 500) {
    return '5xx';
  }
  if (statusCode >= 400) {
    return '4xx';
  }
  if (statusCode >= 300) {
    return '3xx';
  }
  return '2xx';
}

export function compactLogEvent(event: AppLogEvent): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined && value !== null),
  );
}
