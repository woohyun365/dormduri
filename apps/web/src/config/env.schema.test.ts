import { describe, expect, it } from 'vitest';
import {
  parseWebServerEnv,
  WEB_BUILD_PUBLIC_ENV_KEYS,
  WEB_BUILD_SECRET_ENV_KEYS,
  WEB_RUNTIME_SERVER_ENV_KEYS,
  WebEnvValidationError,
  webEnvDefaults,
} from './env.schema';

describe('web env schema', () => {
  it('browser-public build input과 server runtime, build secret을 분리한다', () => {
    expect(WEB_BUILD_PUBLIC_ENV_KEYS).toContain('NEXT_PUBLIC_APP_URL');
    expect(WEB_RUNTIME_SERVER_ENV_KEYS).toContain('WEB_APP_URL');
    expect(WEB_RUNTIME_SERVER_ENV_KEYS).toContain('API_URL');
    expect(WEB_RUNTIME_SERVER_ENV_KEYS).not.toContain('NEXT_PUBLIC_APP_URL');
    expect(WEB_BUILD_SECRET_ENV_KEYS).toContain('SENTRY_AUTH_TOKEN');
    expect(WEB_BUILD_PUBLIC_ENV_KEYS).not.toContain('SENTRY_AUTH_TOKEN');
  });

  it('dev/test에서는 local defaults를 허용한다', () => {
    expect(parseWebServerEnv({ NODE_ENV: 'test' }, 'test')).toEqual(webEnvDefaults);
  });

  it('production에서는 API_URL 누락을 거부한다', () => {
    expect(() =>
      parseWebServerEnv(
        {
          NODE_ENV: 'production',
          WEB_APP_URL: 'https://dormduri.example.com',
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
          WEB_APP_URL: 'https://dormduri.example.com',
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
          WEB_APP_URL: 'http://app.example.com',
          API_URL: 'https://api.example.com',
        },
        'production',
      ),
    ).toThrow(/https/);

    expect(
      parseWebServerEnv(
        {
          NODE_ENV: 'production',
          WEB_APP_URL: 'https://replaceable-host.example/app/',
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
          WEB_APP_URL: 'https://app.example.com/',
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
        bffStructuredLoggingEnabled: true,
        bffSuccessSampleRate: 0.25,
      },
      sentry: {
        enabled: false,
        runtimeErrorsEnabled: false,
        performanceEnabled: false,
        privacyApproved: false,
        releaseEvidenceApproved: false,
        localRecordingEnabled: false,
        tracesSampleRate: 0.1,
      },
    });
  });

  it('production Sentry는 privacy, release evidence, HTTPS DSN이 없으면 no-op이다', () => {
    const base = {
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://app.example.com',
      API_URL: 'https://api.example.com',
      NEXT_PUBLIC_SENTRY_ENABLED: '1',
    };

    expect(parseWebServerEnv(base, 'production').sentry.enabled).toBe(false);
    expect(
      parseWebServerEnv({ ...base, NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: '1' }, 'production').sentry
        .enabled,
    ).toBe(false);
    expect(
      parseWebServerEnv(
        {
          ...base,
          NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: '1',
          NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
        },
        'production',
      ).sentry.enabled,
    ).toBe(false);
    expect(
      parseWebServerEnv(
        {
          ...base,
          NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: '1',
          NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
          NEXT_PUBLIC_SENTRY_DSN: 'http://public@sentry.example.com/1',
        },
        'production',
      ).sentry.enabled,
    ).toBe(false);

    expect(
      parseWebServerEnv(
        {
          ...base,
          NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: '1',
          NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
          NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example.com/1',
          NEXT_PUBLIC_WEB_RELEASE: 'sha-123',
        },
        'production',
      ).sentry,
    ).toMatchObject({
      enabled: true,
      runtimeErrorsEnabled: true,
      performanceEnabled: true,
      privacyApproved: true,
      releaseEvidenceApproved: true,
      dsn: 'https://public@sentry.example.com/1',
    });
  });

  it('Sentry sample 설정 오류는 제품 env parsing을 중단하지 않는다', () => {
    expect(
      parseWebServerEnv(
        { NODE_ENV: 'test', NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: 'invalid' },
        'test',
      ).sentry.tracesSampleRate,
    ).toBe(0.1);
  });
});
