import { describe, expect, it } from 'vitest';
import { normalizeSentryTransactionName, resolveSentryTraceSampleRate } from '../sampling';

describe('Sentry performance sampling', () => {
  it.each([
    [{ enabled: false, configuredRate: 1 }, 0],
    [{ enabled: true, configuredRate: 0 }, 0],
    [{ enabled: true, configuredRate: 0.1 }, 0.1],
    [{ enabled: true, configuredRate: 1 }, 1],
    [{ enabled: true, configuredRate: 2 }, 1],
    [{ enabled: true, configuredRate: Number.NaN }, 0],
  ] as const)('bounded sample rate를 반환한다: %o', (input, expected) => {
    expect(resolveSentryTraceSampleRate(input)).toBe(expected);
  });

  it('raw path와 query를 bounded route group으로 정규화한다', () => {
    expect(normalizeSentryTransactionName('/signup?email=private')).toBe('signup');
    expect(normalizeSentryTransactionName('/main/matching/target-123?token=private')).toBe(
      'main_matching',
    );
  });
});
