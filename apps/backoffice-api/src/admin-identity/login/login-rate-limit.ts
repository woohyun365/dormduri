import { Injectable, type CanActivate } from '@nestjs/common';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import { MINUTE_MS } from '../../platform/time/clock.js';

/** Process-wide ceiling for unauthenticated login and registration requests (README §3: 30/min). */
export const LOGIN_ATTEMPTS_PER_MINUTE = 30;

/**
 * One fixed one-minute window in process memory. The backoffice API runs as one instance
 * (`be.arch.process-state`); account lockout, the per-account limit, lives in the database.
 */
export class LoginRateLimiter {
  private windowStartedAt = 0;
  private count = 0;

  constructor(
    private readonly limit = LOGIN_ATTEMPTS_PER_MINUTE,
    private readonly now: () => number = Date.now,
  ) {}

  tryAcquire(): boolean {
    const now = this.now();
    if (now - this.windowStartedAt >= MINUTE_MS) {
      this.windowStartedAt = now;
      this.count = 0;
    }
    if (this.count >= this.limit) {
      return false;
    }
    this.count += 1;
    return true;
  }
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: LoginRateLimiter) {}

  canActivate(): boolean {
    if (!this.limiter.tryAcquire()) {
      throw new BackofficeApiError('rate_limited');
    }
    return true;
  }
}
