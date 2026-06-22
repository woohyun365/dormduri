import { describe, expect, it, vi } from 'vitest';
import { reportWebVital, sanitizeWebVitalMetric } from '../webVitals';

describe('Web Vitals reporter seam', () => {
  it.each(['LCP', 'INP', 'CLS'] as const)(
    'keeps %s debug payload sanitized for landing performance smoke',
    (name) => {
      const sanitized = sanitizeWebVitalMetric({
        id: `${name.toLowerCase()}-metric`,
        name,
        value: name === 'CLS' ? 0.02 : 180,
        delta: name === 'CLS' ? 0.01 : 20,
        rating: 'good',
        navigationType: 'navigate',
        attribution: {
          element: '<section>사용자 입력 본문</section>',
          interactionTarget: 'a[href="/signup?token=secret"]',
          url: 'https://example.test/private?token=secret',
        },
      });

      expect(sanitized).toMatchObject({
        id: `${name.toLowerCase()}-metric`,
        name,
        attributionKeys: ['element', 'interactionTarget', 'url'],
      });
      expect(JSON.stringify(sanitized)).not.toContain('사용자 입력 본문');
      expect(JSON.stringify(sanitized)).not.toContain('token=secret');
    },
  );

  it('keeps only metric fields and attribution keys', () => {
    expect(
      sanitizeWebVitalMetric({
        id: 'metric-1',
        name: 'LCP',
        value: 1234.56,
        delta: 12,
        rating: 'good',
        navigationType: 'navigate',
        attribution: {
          element: '<main>사용자 텍스트</main>',
          url: 'https://example.test/private?token=secret',
          loadState: 'complete',
        },
      }),
    ).toEqual({
      id: 'metric-1',
      name: 'LCP',
      value: 1234.56,
      delta: 12,
      rating: 'good',
      navigationType: 'navigate',
      attributionKeys: ['element', 'loadState', 'url'],
    });
  });

  it('drops unsupported metric names and non-finite values', () => {
    expect(sanitizeWebVitalMetric({ id: 'metric-1', name: 'CUSTOM', value: 1 })).toBeNull();
    expect(sanitizeWebVitalMetric({ id: 'metric-2', name: 'CLS', value: Number.NaN })).toBeNull();
  });

  it('does not emit logs unless debug env is enabled', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const originalDebugEnv = process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG;

    delete process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG;
    reportWebVital({ id: 'metric-1', name: 'CLS', value: 0.1 });
    expect(debugSpy).not.toHaveBeenCalled();

    process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG = '1';
    reportWebVital({
      id: 'metric-2',
      name: 'INP',
      value: 200,
      attribution: { interactionTarget: 'button', interactionTargetElement: 'button text' },
    });
    expect(debugSpy).toHaveBeenCalledWith('[web-vital]', {
      id: 'metric-2',
      name: 'INP',
      value: 200,
      delta: undefined,
      rating: undefined,
      navigationType: undefined,
      attributionKeys: ['interactionTarget', 'interactionTargetElement'],
    });
    expect(JSON.stringify(debugSpy.mock.calls)).not.toContain('button text');

    if (originalDebugEnv === undefined) delete process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG;
    else process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG = originalDebugEnv;
    debugSpy.mockRestore();
  });
});
