import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecordingOperationalTelemetryAdapter } from '../adapters/recording';
import {
  initializeClientOperationalRuntime,
  resetClientOperationalRuntimeForTests,
} from '../client-runtime';
import { operationalTelemetry, setOperationalTelemetryAdapter } from '../operational-telemetry';

describe('client operational runtime', () => {
  const recording = createRecordingOperationalTelemetryAdapter();
  const originalEnabled = process.env.NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED;
  let restoreAdapter: () => void = () => undefined;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED = '1';
    resetClientOperationalRuntimeForTests();
    recording.clear();
    restoreAdapter = setOperationalTelemetryAdapter(recording);
  });

  afterEach(() => {
    restoreAdapter();
    resetClientOperationalRuntimeForTests();
    if (originalEnabled === undefined) {
      delete process.env.NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED = originalEnabled;
    }
  });

  it('window error listener를 한 번만 등록하고 raw message를 보내지 않는다', async () => {
    initializeClientOperationalRuntime();
    operationalTelemetry.setAdapter(recording);
    initializeClientOperationalRuntime();

    window.dispatchEvent(
      new ErrorEvent('error', { error: new TypeError('student@example.com private value') }),
    );
    await operationalTelemetry.flush();

    expect(recording.events).toHaveLength(1);
    expect(recording.events[0]).toMatchObject({
      eventName: 'web_runtime_error',
      source: 'window_error',
      errorType: 'TypeError',
    });
    expect(JSON.stringify(recording.events)).not.toContain('student@example.com');
  });
});
