import { describe, expect, it } from 'vitest';
import { readSentryRuntimeConfig } from '../config';

describe('Sentry runtime config', () => {
  it('account 정보가 없으면 production capture를 비활성화한다', () => {
    expect(
      readSentryRuntimeConfig('client', {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENABLED: '0',
        NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT: 'production',
      }),
    ).toMatchObject({ captureEnabled: false, environment: 'production' });
  });

  it('local recording은 managed account 없이 활성화된다', () => {
    expect(
      readSentryRuntimeConfig('client', {
        NODE_ENV: 'test',
        NEXT_PUBLIC_SENTRY_LOCAL_RECORDING: '1',
        NEXT_PUBLIC_WEB_RELEASE: 'local-test',
      }),
    ).toMatchObject({
      captureEnabled: true,
      localRecordingEnabled: true,
      release: 'local-test',
      runtimeErrorsEnabled: true,
      performanceEnabled: true,
    });
  });
});
