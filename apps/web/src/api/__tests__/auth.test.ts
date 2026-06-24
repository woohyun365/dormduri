import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../auth';

describe('authApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
