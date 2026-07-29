import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';
import { AuthLoginMetricsService } from './auth-login-metrics.service.js';
import { AuthLoginThrottlerGuard } from './auth-login-throttler.guard.js';
import { AUTH_LOGIN_THROTTLE_ENABLED_METADATA } from './auth-login-throttle.decorator.js';
import { AUTH_LOGIN_BURST_THROTTLER } from './login-throttle.policy.js';

describe('AuthLoginThrottlerGuard', () => {
  it('login IP throttle rejection을 hash/DB 실행 전에 bounded metric으로 기록한다', async () => {
    class AuthControllerFixture {
      login(this: void) {
        return undefined;
      }
    }
    Reflect.defineMetadata(
      AUTH_LOGIN_THROTTLE_ENABLED_METADATA,
      true,
      AuthControllerFixture.prototype.login,
    );
    const request = { ip: '203.0.113.20', headers: {} };
    const response = { header: vi.fn() };
    const context = {
      getClass: () => AuthControllerFixture,
      getHandler: () => AuthControllerFixture.prototype.login,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 31,
        timeToExpire: 60,
        isBlocked: true,
        timeToBlockExpire: 60,
      }),
    };
    const metrics = new AuthLoginMetricsService();
    const recordThrottle = vi.spyOn(metrics, 'recordThrottle');
    const options: ThrottlerModuleOptions = [
      {
        name: AUTH_LOGIN_BURST_THROTTLER,
        limit: 30,
        ttl: 60_000,
      },
    ];
    const guard = new AuthLoginThrottlerGuard(options, storage, new Reflector(), metrics);
    await guard.onModuleInit();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ThrottlerException);

    expect(recordThrottle).toHaveBeenCalledWith('ip_burst');
    expect(storage.increment).toHaveBeenCalledTimes(1);
  });

  it('login metadata가 없는 route는 named login bucket을 소비하지 않는다', async () => {
    class OtherControllerFixture {
      route(this: void) {
        return undefined;
      }
    }
    const context = {
      getClass: () => OtherControllerFixture,
      getHandler: () => OtherControllerFixture.prototype.route,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.21', headers: {} }),
        getResponse: () => ({ header: vi.fn() }),
      }),
    } as unknown as ExecutionContext;
    const storage = {
      increment: vi.fn(),
    };
    const options: ThrottlerModuleOptions = [
      {
        name: AUTH_LOGIN_BURST_THROTTLER,
        limit: 30,
        ttl: 60_000,
      },
    ];
    const guard = new AuthLoginThrottlerGuard(
      options,
      storage,
      new Reflector(),
      new AuthLoginMetricsService(),
    );
    await guard.onModuleInit();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });
});
