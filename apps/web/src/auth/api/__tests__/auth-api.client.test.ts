import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '..';

describe('authApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('verifyEmailCode 429 body retryAfterSeconds를 사용자 문구로 매핑한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TOO_MANY_REQUESTS',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
            retryAfterSeconds: 42,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    await expect(authApi.verifyEmailCode('test@kangwon.ac.kr', '000000')).resolves.toMatchObject({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      error: '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.',
      retryAfterSeconds: 42,
    });
  });

  it('verifyEmailCode 429 Retry-After header를 fallback 재시도 시간으로 사용한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TOO_MANY_REQUESTS',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '37',
            },
          },
        );
      }),
    );

    await expect(authApi.verifyEmailCode('test@kangwon.ac.kr', '000000')).resolves.toMatchObject({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      error: '너무 잦은 요청이에요. 37초 후 다시 시도해주세요.',
      retryAfterSeconds: 37,
    });
  });

  it('sendSignupCode 429 Retry-After header를 반환값에 보존한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TOO_MANY_REQUESTS',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '9',
            },
          },
        );
      }),
    );

    await expect(authApi.sendSignupCode('test@kangwon.ac.kr')).resolves.toEqual({
      success: false,
      error: '너무 잦은 요청이에요. 9초 후 다시 시도해주세요.',
      retryAfterSeconds: 9,
    });
  });

  it('login 429 body retryAfterSeconds를 사용자 문구와 반환값에 보존한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TOO_MANY_REQUESTS',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
            retryAfterSeconds: 42,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    await expect(authApi.login('test@kangwon.ac.kr', 'password123', true)).resolves.toMatchObject({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      error: '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.',
      retryAfterSeconds: 42,
    });
  });

  it('login 429 Retry-After header를 fallback 재시도 시간으로 사용한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TOO_MANY_REQUESTS',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '37',
            },
          },
        );
      }),
    );

    await expect(authApi.login('test@kangwon.ac.kr', 'password123')).resolves.toMatchObject({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      error: '너무 잦은 요청이에요. 37초 후 다시 시도해주세요.',
      retryAfterSeconds: 37,
    });
  });

  it('login BFF safe error와 5xx는 token-free generic server error로 매핑한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
            error: 'accessToken=must-not-show',
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    await expect(authApi.login('test@kangwon.ac.kr', 'password123')).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
      error: '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
    });
  });

  it('login non-JSON response는 raw body를 노출하지 않는 generic server error로 수렴한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('accessToken=must-not-leak', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
    );

    await expect(authApi.login('test@kangwon.ac.kr', 'password123')).resolves.toEqual({
      success: false,
      code: 'BFF_RESPONSE_INVALID',
      error: '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
      userActionable: true,
    });
  });

  it('resolveSession은 browser tri-state contract를 POST route에서 읽는다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ status: 'unauthenticated' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.resolveSession()).resolves.toEqual({ status: 'unauthenticated' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session/resolve',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
      }),
    );
  });

  it('resolveSession은 malformed browser response를 unavailable로 축약한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    await expect(authApi.resolveSession()).resolves.toEqual({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
  });

  it('resolveSession은 stale signal 뒤 최신 browser cookie를 사용할 기회를 한 번만 제공한다', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'unavailable',
            code: 'AUTH_SESSION_UNAVAILABLE',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'x-auth-session-retry-after-milliseconds': '50',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'authenticated',
            user: {
              id: 'user-1',
              email: 'student@kangwon.ac.kr',
              nickname: '테스터',
              gender: 'M',
              campus: 'CHUNCHEON',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const resolution = authApi.resolveSession();
    await vi.advanceTimersByTimeAsync(50);

    await expect(resolution).resolves.toMatchObject({
      status: 'authenticated',
      user: { id: 'user-1' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resolveSession은 재시도 응답이 다시 stale이어도 세 번째 요청을 만들지 않는다', async () => {
    vi.useFakeTimers();
    const staleResponse = () =>
      new Response(
        JSON.stringify({
          status: 'unavailable',
          code: 'AUTH_SESSION_UNAVAILABLE',
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'x-auth-session-retry-after-milliseconds': '50',
          },
        },
      );
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => staleResponse())
      .mockImplementationOnce(async () => staleResponse());
    vi.stubGlobal('fetch', fetchMock);

    const resolution = authApi.resolveSession();
    await vi.advanceTimersByTimeAsync(50);

    await expect(resolution).resolves.toEqual({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sendResetCode 429 body retryAfterSeconds를 반환값에 보존한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUTH_CODE_REQUEST_THROTTLED',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
            retryAfterSeconds: 42,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    await expect(authApi.sendResetCode('test@kangwon.ac.kr')).resolves.toEqual({
      success: false,
      error: '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.',
      retryAfterSeconds: 42,
    });
  });

  it('password reset 요청들은 전달받은 AbortSignal을 fetch에 연결한다', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          success: true,
          grantExpiresInSeconds: 900,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await authApi.sendResetCode('test@kangwon.ac.kr', controller.signal);
    await authApi.verifyResetCode('test@kangwon.ac.kr', '000000', controller.signal);
    await authApi.resetPassword('test@kangwon.ac.kr', 'NewPass1234', controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toEqual(expect.objectContaining({ signal: controller.signal }));
    }
  });

  it('verifyResetCode 429 Retry-After header를 fallback 재시도 시간으로 사용한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUTH_CODE_REQUEST_THROTTLED',
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '27',
            },
          },
        );
      }),
    );

    await expect(authApi.verifyResetCode('test@kangwon.ac.kr', '000000')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_CODE_REQUEST_THROTTLED',
      error: '너무 잦은 요청이에요. 27초 후 다시 시도해주세요.',
      retryAfterSeconds: 27,
    });
  });

  it('resetPassword 429 Retry-After header와 fieldErrors를 반환값에 보존한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUTH_PASSWORD_POLICY_VIOLATION',
            error: '새 비밀번호를 다시 확인해주세요.',
            fieldErrors: {
              newPassword: '이전에 사용한 비밀번호는 사용할 수 없어요.',
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '19',
            },
          },
        );
      }),
    );

    await expect(authApi.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toEqual({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
      error: '너무 잦은 요청이에요. 19초 후 다시 시도해주세요.',
      fieldErrors: {
        newPassword: '이전에 사용한 비밀번호는 사용할 수 없어요.',
      },
      retryAfterSeconds: 19,
    });
  });

  it('resetPassword BFF safe error와 5xx는 token-free generic server error로 매핑한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
            error: 'accessToken=must-not-show',
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    await expect(authApi.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
      error: '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
    });
  });

  it('resetPassword non-JSON response는 raw body를 노출하지 않는 generic server error로 수렴한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('accessToken=must-not-leak', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
    );

    await expect(authApi.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toEqual({
      success: false,
      code: 'BFF_RESPONSE_INVALID',
      error: '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
      userActionable: true,
    });
  });
});
