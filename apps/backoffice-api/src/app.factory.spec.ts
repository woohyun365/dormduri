import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackofficeApplication } from './app.factory.js';
import { loadBackofficeSettings } from './platform/config/backoffice-settings.js';
import { BackofficeLogger } from './platform/observability/backoffice-logger.js';

describe('backoffice HTTP security headers', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Nothing here touches the database: the Prisma clients connect on their first query.
    const settings = loadBackofficeSettings({
      NODE_ENV: 'test',
      BACKOFFICE_DATABASE_URL: 'postgresql://headers:unused@127.0.0.1:1/unused',
      BACKOFFICE_RETENTION_DATABASE_URL: 'postgresql://headers-retention:unused@127.0.0.1:1/unused',
      BACKOFFICE_TOTP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    app = await createBackofficeApplication(settings, { logger: new BackofficeLogger('error') });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(['/health/live', '/no-such-route'])(
    'sends deny-all CSP, no-store and nosniff on %s',
    async (path) => {
      const response = await request(app.getHttpServer() as Server).get(path);
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-powered-by']).toBeUndefined();
    },
  );

  it('answers an unknown route with the error envelope, not a framework page', async () => {
    const response = await request(app.getHttpServer() as Server).get('/no-such-route');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'not_found' } });
  });
});
