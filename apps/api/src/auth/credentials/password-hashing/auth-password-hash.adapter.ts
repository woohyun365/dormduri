import { Injectable } from '@nestjs/common';
import { AuthLoginMetricsService } from '../../login-attempts/auth-login-metrics.service.js';
import { AUTH_LOGIN_CANONICAL_DUMMY_HASH, verifyPasswordHash } from './password-hash.js';

@Injectable()
export class AuthPasswordHashPolicy {
  constructor(private readonly loginMetrics: AuthLoginMetricsService) {}

  async verifyLoginPassword(passwordHash: string, password: string): Promise<boolean> {
    return this.verifyWithMetrics('real', passwordHash, password, 'login_verify');
  }

  async verifyUnavailableLogin(password: string): Promise<void> {
    await this.verifyWithMetrics('dummy', AUTH_LOGIN_CANONICAL_DUMMY_HASH, password, 'login_dummy');
  }

  private async verifyWithMetrics(
    target: 'dummy' | 'real',
    passwordHash: string,
    password: string,
    operation: 'login_dummy' | 'login_verify',
  ): Promise<boolean> {
    const complete = this.loginMetrics.startPasswordVerify(target);
    try {
      return await verifyPasswordHash(passwordHash, password, operation);
    } finally {
      complete();
    }
  }
}
