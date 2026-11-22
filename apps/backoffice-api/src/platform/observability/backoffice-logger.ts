import type { LoggerService } from '@nestjs/common';
import { pino, type Logger } from 'pino';

export const LOG_REDACTED = '[REDACTED]';

// Keys whose value never reaches stdout (OA-R7: secrets, codes, tokens, passkey responses and
// account identifiers). Matching is on the key name at any depth.
const FORBIDDEN_KEY = [
  /authorization/iu,
  /cookie/iu,
  /password/iu,
  /token/iu,
  /secret/iu,
  /code/iu,
  /credential/iu,
  /challenge/iu,
  /attestation/iu,
  /assertion/iu,
  /signature/iu,
  /public.?key/iu,
  /^email$/iu,
  /^displayName$/iu,
  /^reason$/iu,
  /^note$/iu,
  /body/iu,
  /^ip$/iu,
];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
const BEARER = /Bearer\s+[^\s,;]+/giu;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/gu;

export function isForbiddenLogKey(key: string): boolean {
  return FORBIDDEN_KEY.some((pattern) => pattern.test(key));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function redactString(value: string): string {
  // Request, session and row ids are UUIDs that correlate log lines with audit rows.
  if (UUID.test(value)) {
    return value;
  }
  return value
    .replace(EMAIL, LOG_REDACTED)
    .replace(BEARER, `Bearer ${LOG_REDACTED}`)
    .replace(LONG_TOKEN, LOG_REDACTED);
}

export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Error) {
    return { errorName: value.name };
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isForbiddenLogKey(key) ? LOG_REDACTED : redactLogValue(item, seen),
    ]),
  );
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured stdout log (pino). Every field passes through {@link redactLogValue}. */
export class BackofficeLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(level: LogLevel = 'info', destination?: pino.DestinationStream) {
    this.logger = pino(
      {
        level,
        base: { service: 'backoffice-api' },
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: { level: (label) => ({ level: label }) },
      },
      destination,
    );
  }

  event(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
    this.logger[level]({ event, ...(redactLogValue(fields) as Record<string, unknown>) });
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, _trace?: string, context?: string): void {
    this.write('error', message, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string): void {
    const text = message instanceof Error ? message.name : String(message);
    this.logger[level]({ event: 'nest', context, message: redactString(text) });
  }
}
