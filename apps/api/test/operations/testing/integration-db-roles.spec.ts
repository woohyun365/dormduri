import { describe, expect, it } from 'vitest';
import {
  assertDisposableIntegrationDatabase,
  INTEGRATION_DISPOSABLE_DATABASE_ENV,
} from '../../integration/_support/integration-db-roles.js';

describe('integration role bootstrap target guard', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('loopback PostgreSQL(%s)은 허용한다', (host) => {
    expect(() =>
      assertDisposableIntegrationDatabase(`postgresql://admin:pw@${host}:5432/dormduri`, {}),
    ).not.toThrow();
  });

  it('loopback이 아닌 대상은 opt-in 없이 거부하고 URL을 출력하지 않는다', () => {
    const url = 'postgresql://master:secret-value@db.internal.example:5432/dormduri';
    expect(() => assertDisposableIntegrationDatabase(url, {})).toThrow(
      /integration role bootstrap refused/u,
    );
    try {
      assertDisposableIntegrationDatabase(url, {});
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
      expect(String(error)).not.toContain('db.internal.example');
    }
  });

  it('disposable opt-in(yes)이면 loopback이 아니어도 허용한다', () => {
    expect(() =>
      assertDisposableIntegrationDatabase('postgresql://admin:pw@postgres:5432/dormduri', {
        [INTEGRATION_DISPOSABLE_DATABASE_ENV]: 'yes',
      }),
    ).not.toThrow();
  });
});
