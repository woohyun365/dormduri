import { Injectable } from '@nestjs/common';
import { LoginAttemptRepository } from './login-attempt.repository.js';

@Injectable()
export class ClearLoginFailuresCommand {
  constructor(private readonly repository: LoginAttemptRepository) {}

  async execute(emailNormalized: string): Promise<void> {
    await this.repository.clearFailures(emailNormalized);
  }
}
