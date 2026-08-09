import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeClientOperationalRuntime,
  resetClientOperationalRuntimeForTests,
} from '../client-runtime';

describe('client operational runtime', () => {
  beforeEach(() => {
    resetClientOperationalRuntimeForTests();
  });

  afterEach(() => {
    resetClientOperationalRuntimeForTests();
    vi.restoreAllMocks();
  });

  it('Sentry가 소유하는 global error listener를 별도로 등록하지 않는다', () => {
    const listenerSpy = vi.spyOn(window, 'addEventListener');

    initializeClientOperationalRuntime();
    initializeClientOperationalRuntime();

    expect(listenerSpy).not.toHaveBeenCalledWith('error', expect.any(Function));
    expect(listenerSpy).not.toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
});
