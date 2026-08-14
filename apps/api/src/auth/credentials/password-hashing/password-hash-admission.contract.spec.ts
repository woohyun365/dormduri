import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeArgon = vi.hoisted(() => {
  let active = 0;
  let peak = 0;

  const run = async <T>(result: T): Promise<T> => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return result;
  };

  return {
    hash: vi.fn(() => run('$argon2id$v=19$m=19456,t=2,p=1$test$hash')),
    verify: vi.fn(() => run(true)),
    reset() {
      active = 0;
      peak = 0;
    },
    getPeak() {
      return peak;
    },
  };
});

vi.mock('@node-rs/argon2', () => ({
  hash: nativeArgon.hash,
  verify: nativeArgon.verify,
}));

import { hashPassword, verifyPasswordHash } from './password-hash.js';

describe('password hash global admission contract', () => {
  beforeEach(() => {
    nativeArgon.reset();
    vi.clearAllMocks();
  });

  it('endpoint limiter와 무관하게 hash와 verify의 native 동시 실행을 bounded 처리한다', async () => {
    const operations = Array.from({ length: 12 }, (_, index) =>
      index % 2 === 0
        ? hashPassword(`Password-${index}`)
        : verifyPasswordHash('legacy-hash', `Password-${index}`),
    );

    await expect(Promise.all(operations)).resolves.toHaveLength(12);
    expect(nativeArgon.getPeak()).toBeLessThanOrEqual(4);
  });

  it('bounded queue를 넘는 요청은 native Argon 작업을 시작하지 않고 거절한다', async () => {
    const operations = Array.from({ length: 37 }, (_, index) => hashPassword(`Password-${index}`));

    const results = await Promise.allSettled(operations);
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(rejected).toHaveLength(1);
    const reason: unknown = rejected[0]?.reason;
    expect(reason).toMatchObject({
      code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
      retryAfterSeconds: 2,
    });
    expect(nativeArgon.hash).toHaveBeenCalledTimes(36);
    expect(nativeArgon.getPeak()).toBeLessThanOrEqual(4);
  });
});
