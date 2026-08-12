import { describe, expect, it } from 'vitest';
import { ThrottlerStorageService } from '@nestjs/throttler';
import {
  DEFAULT_AUTH_LOGIN_BURST_LIMIT,
  DEFAULT_AUTH_LOGIN_BURST_WINDOW_SECONDS,
  DEFAULT_AUTH_LOGIN_SUSTAINED_LIMIT,
  DEFAULT_AUTH_LOGIN_SUSTAINED_WINDOW_SECONDS,
} from '../../config/auth.config.js';
import { buildAuthThrottlerOptions } from './auth-throttle.options.js';
import {
  AUTH_LOGIN_BURST_THROTTLER,
  AUTH_LOGIN_SUSTAINED_THROTTLER,
} from './login-throttle.policy.js';

const options = buildAuthThrottlerOptions({
  authThrottleLimit: 60,
  authLoginBurstLimit: DEFAULT_AUTH_LOGIN_BURST_LIMIT,
  authLoginBurstWindowSeconds: DEFAULT_AUTH_LOGIN_BURST_WINDOW_SECONDS,
  authLoginSustainedLimit: DEFAULT_AUTH_LOGIN_SUSTAINED_LIMIT,
  authLoginSustainedWindowSeconds: DEFAULT_AUTH_LOGIN_SUSTAINED_WINDOW_SECONDS,
});

function requireThrottler(name: string) {
  const option = options.find((candidate) => candidate.name === name);
  if (!option || typeof option.limit !== 'number' || typeof option.ttl !== 'number') {
    throw new Error(`Missing static throttler option: ${name}`);
  }
  return option;
}

describe('buildAuthThrottlerOptions', () => {
  it('shared NAT의 정상 20명 burst는 30/min IP bucket 안에서 허용한다', async () => {
    const burst = requireThrottler(AUTH_LOGIN_BURST_THROTTLER);
    const storage = new ThrottlerStorageService();

    try {
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          storage.increment(
            'shared-campus-ip',
            burst.ttl as number,
            burst.limit as number,
            burst.ttl as number,
            AUTH_LOGIN_BURST_THROTTLER,
          ),
        ),
      );

      expect(results.every((result) => !result.isBlocked)).toBe(true);
    } finally {
      storage.onApplicationShutdown();
    }
  });

  it('31번째 burst와 121번째 sustained 요청은 각각의 IP bucket에서 차단한다', async () => {
    const storage = new ThrottlerStorageService();
    const burst = requireThrottler(AUTH_LOGIN_BURST_THROTTLER);
    const sustained = requireThrottler(AUTH_LOGIN_SUSTAINED_THROTTLER);

    try {
      let burstResult;
      for (let index = 0; index <= DEFAULT_AUTH_LOGIN_BURST_LIMIT; index += 1) {
        burstResult = await storage.increment(
          'abuse-burst-ip',
          burst.ttl as number,
          burst.limit as number,
          burst.ttl as number,
          AUTH_LOGIN_BURST_THROTTLER,
        );
      }

      let sustainedResult;
      for (let index = 0; index <= DEFAULT_AUTH_LOGIN_SUSTAINED_LIMIT; index += 1) {
        sustainedResult = await storage.increment(
          'abuse-sustained-ip',
          sustained.ttl as number,
          sustained.limit as number,
          sustained.ttl as number,
          AUTH_LOGIN_SUSTAINED_THROTTLER,
        );
      }

      expect(burstResult?.isBlocked).toBe(true);
      expect(sustainedResult?.isBlocked).toBe(true);
    } finally {
      storage.onApplicationShutdown();
    }
  });
});
