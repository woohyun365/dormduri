import { describe, expect, it, vi, type MockInstance } from 'vitest';
import request from 'supertest';
import { AppLoggerService } from '../../../src/platform/observability/logging/app-logger.service.js';
import type { AppLogEvent } from '../../../src/platform/observability/logging/log-event.js';
import { useIntegrationTestSuite } from '../_support/integration-suite.js';

// The HTTP adapter does not expose the matched route, so ObservabilityModule's global guard
// records the template from Nest metadata. AppModule imports that module before AuthModule, so
// its guard runs first and auth or throttle rejections still log the route template. This pins
// that order across framework upgrades, like the lifecycle hook order spec.
describe('HTTP route template on guard rejections', () => {
  const suite = useIntegrationTestSuite('request_route_template');

  function httpServer() {
    return suite.app.getHttpServer() as Parameters<typeof request>[0];
  }

  function exceptionEvents(write: MockInstance<AppLoggerService['write']>): AppLogEvent[] {
    return write.mock.calls
      .map(([, event]) => event)
      .filter((event) => event.operation === 'http_exception');
  }

  it('logs the template for an authentication guard rejection', async () => {
    const write = vi.spyOn(suite.app.get(AppLoggerService), 'write');
    try {
      const response = await request(httpServer()).get('/api/users/me');
      expect(response.status).toBe(401);
      expect(exceptionEvents(write)).toEqual([
        expect.objectContaining({ route: '/api/users/me', statusCode: 401 }),
      ]);
    } finally {
      write.mockRestore();
    }
  });

  it('logs the template for a login throttle rejection', async () => {
    const write = vi.spyOn(suite.app.get(AppLoggerService), 'write');
    try {
      // The route allows five requests a minute; the invalid body fails after the guards.
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await request(httpServer()).post('/auth/verify-email-code').send({});
        statuses.push(response.status);
      }
      expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
      expect(
        exceptionEvents(write).map(({ route, statusCode }) => ({ route, statusCode })),
      ).toEqual(
        [...statuses].map((statusCode) => ({ route: '/auth/verify-email-code', statusCode })),
      );
    } finally {
      write.mockRestore();
    }
  });

  it('keeps UNKNOWN_ROUTE for a path no route matches', async () => {
    const write = vi.spyOn(suite.app.get(AppLoggerService), 'write');
    try {
      const response = await request(httpServer()).get('/API/users/me');
      expect(response.status).toBe(404);
      expect(exceptionEvents(write)).toEqual([
        expect.objectContaining({ route: 'UNKNOWN_ROUTE', statusCode: 404 }),
      ]);
    } finally {
      write.mockRestore();
    }
  });
});
