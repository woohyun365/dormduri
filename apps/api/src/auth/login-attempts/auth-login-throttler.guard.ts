import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { AuthLoginMetricsService } from './auth-login-metrics.service.js';
import { AUTH_LOGIN_THROTTLE_ENABLED_METADATA } from './auth-login-throttle.decorator.js';
import { resolveAuthLoginThrottleScope } from './login-throttle.policy.js';

@Injectable()
export class AuthLoginThrottlerGuard extends ThrottlerGuard {
  private readonly authReflector: Reflector;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly loginMetrics: AuthLoginMetricsService,
  ) {
    super(options, storageService, reflector);
    this.authReflector = reflector;
  }

  protected override async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const scope = resolveAuthLoginThrottleScope(request.throttler.name);
    if (
      scope &&
      !this.authReflector.getAllAndOverride<boolean>(AUTH_LOGIN_THROTTLE_ENABLED_METADATA, [
        request.context.getHandler(),
        request.context.getClass(),
      ])
    ) {
      return true;
    }

    try {
      return await super.handleRequest(request);
    } catch (error) {
      if (error instanceof ThrottlerException && scope) {
        this.loginMetrics.recordThrottle(scope);
      }
      throw error;
    }
  }
}
