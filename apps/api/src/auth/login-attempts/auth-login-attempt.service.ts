import { Injectable } from '@nestjs/common';
import type { LoginResult } from '../auth.types.js';
import type { AuthRequestContext } from '../auth-request-context.js';
import { ClearLoginFailuresCommand } from './clear-login-failures.command.js';
import { GetActiveLoginLockQuery } from './get-active-login-lock.query.js';
import { RecordLoginFailureCommand } from './record-login-failure.command.js';

@Injectable()
export class AuthLoginAttemptService {
  constructor(
    private readonly activeLockQuery: GetActiveLoginLockQuery,
    private readonly recordFailureCommand: RecordLoginFailureCommand,
    private readonly clearFailuresCommand: ClearLoginFailuresCommand,
  ) {}

  async getActiveLock(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult | null> {
    return this.activeLockQuery.execute(emailNormalized, requestContext);
  }

  async clearFailures(emailNormalized: string): Promise<void> {
    await this.clearFailuresCommand.execute(emailNormalized);
  }

  async recordLoginFailure(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    return this.recordFailureCommand.execute(emailNormalized, requestContext);
  }
}
