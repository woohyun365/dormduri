import { describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';
import { AppLoggerService } from './app-logger.service.js';
import { RequestContextService } from './request-context.service.js';

const settings = {
  env: 'test',
  logHashSecret: 'test-secret',
  logLevel: 'debug',
  logPretty: false,
  metricsEnabled: true,
  metricsBearerToken: 'metrics-secret',
  metricsRoute: 'internal/metrics',
  metricsHttpDurationBuckets: [0.05, 0.1, 0.2],
  serviceName: 'api',
} satisfies ConfigType<typeof observabilityConfig>;

function createHarness() {
  const requestContext = new RequestContextService(settings);
  const logger = new AppLoggerService(settings, requestContext);
  const writeToPino = vi.fn();

  Object.defineProperty(logger, 'writeToPino', {
    configurable: true,
    value: writeToPino,
  });

  return { logger, requestContext, writeToPino };
}

describe('AppLoggerService', () => {
  it('adds request context and redacts unsafe log values before writing', () => {
    const { logger, requestContext, writeToPino } = createHarness();

    requestContext.run(
      {
        correlationId: 'corr-12345678',
        requestId: 'req-12345678',
      },
      () => {
        requestContext.setActor('user-1');
        logger.write(
          'info',
          {
            operation: 'login',
            route: '/auth/login',
          },
          'failed email=student@knu.ac.kr token=secret',
        );
      },
    );

    const [level, event, message] = writeToPino.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];

    expect(level).toBe('info');
    expect(typeof event.actorHash).toBe('string');
    expect(event).toMatchObject({
      correlationId: 'corr-12345678',
      operation: 'login',
      requestId: 'req-12345678',
      route: '/auth/login',
    });
    expect(message).toBe('failed email=[REDACTED] token=[REDACTED]');
  });

  it('does not throw when the underlying logger fails', () => {
    const { logger } = createHarness();

    Object.defineProperty(logger, 'writeToPino', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('logger unavailable');
      }),
    });

    expect(() => logger.write('error', { operation: 'test' }, 'boom')).not.toThrow();
  });
});
