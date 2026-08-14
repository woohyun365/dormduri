import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { LoginAttemptRepository } from './login-attempt.repository.js';

@Injectable()
export class ClearLoginFailuresCommand {
  constructor(private readonly repository: LoginAttemptRepository) {}

  async execute(emailNormalized: string): Promise<void> {
    await this.repository.clearFailures(emailNormalized);
  }

  async executeInTransaction(
    tx: Pick<Prisma.TransactionClient, 'loginAttempt'>,
    emailNormalized: string,
  ): Promise<void> {
    await this.repository.clearFailuresInTransaction(tx, emailNormalized);
  }
}
