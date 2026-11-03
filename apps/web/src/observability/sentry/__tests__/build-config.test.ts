import { describe, expect, it } from 'vitest';
import { resolveSentryBuildConfig } from '../build-config';

describe('Sentry build config', () => {
  it('account secret이 없으면 source map upload를 건너뛴다', () => {
    const config = resolveSentryBuildConfig({
      SENTRY_SOURCE_MAP_UPLOAD_ENABLED: '1',
      SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
      NEXT_PUBLIC_WEB_RELEASE: 'sha-1',
    });

    expect(config.uploadRequested).toBe(true);
    expect(config.uploadEnabled).toBe(false);
    expect(config.options.sourcemaps?.disable).toBe(true);
    expect(config.options.authToken).toBeUndefined();
  });

  it('모든 server-only release input이 있을 때만 upload를 연다', () => {
    const config = resolveSentryBuildConfig({
      SENTRY_SOURCE_MAP_UPLOAD_ENABLED: '1',
      SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
      SENTRY_ORG: 'dormduri',
      SENTRY_PROJECT: 'web',
      SENTRY_AUTH_TOKEN: 'secret-token',
      SENTRY_RELEASE: 'sha-1',
      NEXT_PUBLIC_WEB_RELEASE: 'sha-1',
    });

    expect(config.uploadEnabled).toBe(true);
    expect(config.options.sourcemaps).toMatchObject({
      disable: false,
      deleteSourcemapsAfterUpload: true,
    });
  });

  it('client/server release가 다르면 upload를 열지 않는다', () => {
    const config = resolveSentryBuildConfig({
      SENTRY_SOURCE_MAP_UPLOAD_ENABLED: '1',
      SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
      SENTRY_ORG: 'dormduri',
      SENTRY_PROJECT: 'web',
      SENTRY_AUTH_TOKEN: 'secret-token',
      SENTRY_RELEASE: 'server-sha',
      NEXT_PUBLIC_WEB_RELEASE: 'client-sha',
    });

    expect(config.uploadEnabled).toBe(false);
  });
});
