import { Injectable } from '@nestjs/common';
import type { LoginResponse } from '@repo/shared/auth/response';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { AuthRequestContext } from '../../domain/auth-request-context.js';
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
  ): Promise<LoginResponse | null> {
    return this.activeLockQuery.execute(emailNormalized, requestContext);
  }

  async clearFailures(emailNormalized: string): Promise<void> {
    await this.clearFailuresCommand.execute(emailNormalized);
  }

  async clearFailuresInTransaction(
    tx: Pick<Prisma.TransactionClient, 'loginAttempt'>,
    emailNormalized: string,
  ): Promise<void> {
    await this.clearFailuresCommand.executeInTransaction(tx, emailNormalized);
  }

  async recordLoginFailure(
    emailNormalized: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResponse> {
    return this.recordFailureCommand.execute(emailNormalized, requestContext);
  }
}
