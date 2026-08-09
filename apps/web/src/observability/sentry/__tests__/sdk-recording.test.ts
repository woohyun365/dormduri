import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSentryRuntimeConfig } from '../config';
import { buildClientSentryOptions } from '../options';
import { clearRecordedSentryEnvelopes, getRecordedSentryEnvelopes } from '../recording-transport';

function recordingConfig() {
  return readSentryRuntimeConfig('client', {
    NODE_ENV: 'test',
    NEXT_PUBLIC_SENTRY_LOCAL_RECORDING: '1',
    NEXT_PUBLIC_WEB_RELEASE: 'local-rehearsal',
  });
}

describe('Sentry SDK recording integration', () => {
  beforeEach(() => {
    clearRecordedSentryEnvelopes();
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RECORDING_TRANSPORT_REJECT', '0');
  });

  afterEach(async () => {
    await Sentry.close(100);
    vi.unstubAllEnvs();
  });

  it('scrub된 exception envelope를 외부 network 없이 기록한다', async () => {
    Sentry.init(buildClientSentryOptions(recordingConfig()));
    Sentry.captureException(new TypeError('knuStudent@kangwon.ac.kr private form value'));

    expect(await Sentry.flush(1_000)).toBe(true);
    const serialized = JSON.stringify(getRecordedSentryEnvelopes());
    expect(serialized).toContain('TypeError');
    expect(serialized).not.toMatch(/knuStudent|kangwon|private form value/);
  });

  it('transport rejection이 사용자 호출부로 전파되지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RECORDING_TRANSPORT_REJECT', '1');
    Sentry.init(buildClientSentryOptions(recordingConfig()));

    expect(() => Sentry.captureException(new Error('synthetic failure'))).not.toThrow();
    await expect(Sentry.flush(200)).resolves.toBeTypeOf('boolean');
  });
});
