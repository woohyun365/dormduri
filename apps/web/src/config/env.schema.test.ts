import { describe, expect, it } from 'vitest';
import { parseWebServerEnv, WebEnvValidationError, webEnvDefaults } from './env.schema';

describe('web env schema', () => {
  it('dev/test에서는 local defaults를 허용한다', () => {
    expect(parseWebServerEnv({ NODE_ENV: 'test' }, 'test')).toEqual(webEnvDefaults);
  });

  it('production에서는 API_URL 누락을 거부한다', () => {
    expect(() =>
      parseWebServerEnv(
        {
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'https://knu-roommate.example.com',
        },
        'production',
      ),
    ).toThrow(WebEnvValidationError);
  });

  it('production에서는 localhost upstream fallback을 거부한다', () => {
    expect(() =>
      parseWebServerEnv(
        {
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'https://knu-roommate.example.com',
          API_URL: 'http://localhost:4000',
        },
        'production',
      ),
    ).toThrow(/localhost/);
  });

  it('production canonical app origin은 주입된 HTTPS URL만 허용한다', () => {
    expect(() =>
      parseWebServerEnv(
        {
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'http://app.example.com',
          API_URL: 'https://api.example.com',
        },
        'production',
      ),
    ).toThrow(/https/);

    expect(
      parseWebServerEnv(
        {
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'https://replaceable-host.example/app/',
          API_URL: 'https://api.example.com',
        },
        'production',
      ).appUrl,
    ).toBe('https://replaceable-host.example/app');
  });

  it('invalid absolute URL을 거부한다', () => {
    expect(() =>
      parseWebServerEnv(
        {
          API_URL: 'postgres://localhost:5432/app',
        },
        'development',
      ),
    ).toThrow(WebEnvValidationError);
  });

  it('same-origin public API base default와 trailing slash normalization을 유지한다', () => {
    expect(
      parseWebServerEnv(
        {
          API_URL: 'https://api.example.com/',
          NEXT_PUBLIC_APP_URL: 'https://app.example.com/',
          NEXT_PUBLIC_API_URL: '/api/',
        },
        'production',
      ),
    ).toEqual({
      appUrl: 'https://app.example.com',
      apiUpstreamUrl: 'https://api.example.com',
      publicApiBase: '/api',
      operationalTelemetry: {
        environment: 'production',
        release: 'development',
        browserEnabled: false,
        runtimeErrorsEnabled: false,
        webVitalsEnabled: false,
        privacyApproved: false,
        bffStructuredLoggingEnabled: true,
        bffSuccessSampleRate: 0.25,
        sourceMapsEnabled: false,
      },
    });
  });

  it('production browser telemetry는 privacy, retention, HTTPS endpoint를 모두 요구한다', () => {
    const base = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED: '1',
    };

    expect(() => parseWebServerEnv(base, 'production')).toThrow(/privacy/i);
    expect(() =>
      parseWebServerEnv({ ...base, NEXT_PUBLIC_WEB_TELEMETRY_PRIVACY_APPROVED: '1' }, 'production'),
    ).toThrow(/retention/i);
    expect(() =>
      parseWebServerEnv(
        {
          ...base,
          NEXT_PUBLIC_WEB_TELEMETRY_PRIVACY_APPROVED: '1',
          NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS: '30',
        },
        'production',
      ),
    ).toThrow(/endpoint/i);

    expect(
      parseWebServerEnv(
        {
          ...base,
          NEXT_PUBLIC_WEB_TELEMETRY_PRIVACY_APPROVED: '1',
          NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS: '30',
          NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT: 'https://telemetry.example.com/intake',
          NEXT_PUBLIC_WEB_RELEASE: 'sha-123',
        },
        'production',
      ).operationalTelemetry,
    ).toMatchObject({
      browserEnabled: true,
      runtimeErrorsEnabled: true,
      webVitalsEnabled: true,
      privacyApproved: true,
      retentionDays: 30,
      endpoint: 'https://telemetry.example.com/intake',
      release: 'sha-123',
    });
  });
});
