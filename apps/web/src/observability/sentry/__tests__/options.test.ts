import { describe, expect, it } from 'vitest';
import { buildClientSentryOptions } from '../options';
import { readSentryRuntimeConfig } from '../config';

describe('Sentry SDK options', () => {
  it('PII와 Replay를 비활성화하고 production trace를 10%로 제한한다', () => {
    const config = readSentryRuntimeConfig('client', {
      NODE_ENV: 'production',
      NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT: 'production',
      NEXT_PUBLIC_WEB_RELEASE: 'sha-1',
      NEXT_PUBLIC_SENTRY_ENABLED: '1',
      NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: '1',
      NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED: '1',
      NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example.com/1',
      NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0.1',
    });
    const options = buildClientSentryOptions(config);

    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0.1);
    const integrations = (
      options.integrations as (values: { name: string }[]) => { name: string }[]
    )([{ name: 'Replay' }, { name: 'GlobalHandlers' }]);
    expect(integrations).toEqual([{ name: 'GlobalHandlers' }]);
  });

  it('runtime과 performance kill switch를 독립적으로 적용한다', async () => {
    const config = readSentryRuntimeConfig('client', {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SENTRY_LOCAL_RECORDING: '1',
      NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED: '0',
      NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED: '1',
      NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '1',
    });
    const options = buildClientSentryOptions(config);

    expect(options.tracesSampleRate).toBe(1);
    expect(
      await options.beforeSend?.(
        { type: undefined, exception: { values: [{ type: 'Error' }] } },
        {},
      ),
    ).toBeNull();
    expect(
      options.beforeSendTransaction?.({ type: 'transaction', transaction: '/signup' }, {}),
    ).toMatchObject({ transaction: 'signup' });

    const integrations = (
      options.integrations as (values: { name: string }[]) => { name: string }[]
    )([{ name: 'GlobalHandlers' }, { name: 'BrowserTracing' }]);
    expect(integrations).toEqual([{ name: 'BrowserTracing' }]);
  });
});
