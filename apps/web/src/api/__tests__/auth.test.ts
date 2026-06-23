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
});
