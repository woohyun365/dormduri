import { describe, expect, it } from 'vitest';
import {
  scrubSentryBreadcrumb,
  scrubSentryErrorEvent,
  scrubSentrySpan,
  scrubSentryTransaction,
} from '../privacy';

describe('Sentry privacy scrub', () => {
  it('identity, request, form content를 제거하고 stack 위치만 유지한다', () => {
    const event = scrubSentryErrorEvent(
      {
        type: undefined,
        user: { email: 'knuStudent@kangwon.ac.kr' },
        request: { headers: { authorization: 'Bearer secret' }, data: 'private form' },
        extra: { chat: 'private chat' },
        tags: { routeGroup: 'signup', nickname: '감자친구' },
        contexts: {
          trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) },
          browser: { name: 'private-browser', version: 'private-version' },
        },
        exception: {
          values: [
            {
              type: 'TypeError',
              value: 'knuStudent@kangwon.ac.kr private value',
              stacktrace: {
                frames: [
                  {
                    filename: 'app.js?email=private',
                    abs_path: 'https://app.example.com/app.js?token=private',
                    function: 'render',
                    lineno: 10,
                    colno: 2,
                    context_line: 'const password = "secret"',
                    vars: { password: 'secret' },
                  },
                ],
              },
            },
          ],
        },
      },
      { originalException: new TypeError('private value') },
    );

    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/kangwon|Bearer|private form|private chat|감자친구|password/);
    expect(event.tags).toEqual({ routeGroup: 'signup' });
    expect(event.exception?.values?.[0]?.value).toBe('TypeError');
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]).toMatchObject({
      filename: 'app.js',
      abs_path: 'https://app.example.com/app.js',
      lineno: 10,
      colno: 2,
    });
    expect(event.contexts).not.toHaveProperty('browser');
  });

  it('console과 http breadcrumb는 수집하지 않는다', () => {
    expect(scrubSentryBreadcrumb({ category: 'console', message: 'private' })).toBeNull();
    expect(scrubSentryBreadcrumb({ type: 'http', data: { url: '/private' } })).toBeNull();
    expect(scrubSentryBreadcrumb({ category: 'ui.click', message: 'private label' })).toEqual({
      category: 'ui.click',
      level: undefined,
      timestamp: undefined,
      type: undefined,
    });
  });

  it('transaction과 span에서 raw path와 data를 제거한다', () => {
    const transaction = scrubSentryTransaction({
      type: 'transaction',
      transaction: '/signup?email=private',
      request: { url: '/signup?email=private' },
      spans: [
        {
          span_id: 'a'.repeat(16),
          trace_id: 'b'.repeat(32),
          start_timestamp: 1,
          description: '/signup?email=private',
          data: { email: 'private' },
        },
      ],
    });
    expect(transaction.transaction).toBe('signup');
    expect(transaction.request).toBeUndefined();
    expect(transaction.spans?.[0]?.data).toEqual({});

    const span = scrubSentrySpan({
      span_id: 'a'.repeat(16),
      trace_id: 'b'.repeat(32),
      start_timestamp: 1,
      description: '/private',
      data: { token: 'secret' },
    });
    expect(span).toMatchObject({ data: {} });
    expect(span).not.toHaveProperty('description');
  });
});
