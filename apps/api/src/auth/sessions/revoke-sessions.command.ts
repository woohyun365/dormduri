import { Injectable } from '@nestjs/common';
import { AuthSessionRepository } from './auth-session.repository.js';

@Injectable()
export class RevokeSessionsCommand {
  constructor(private readonly repository: AuthSessionRepository) {}

  async revokeSessionIds(sessionIds: string[], revokedAt: Date) {
    if (sessionIds.length === 0) {
      return { count: 0 };
    }

    return this.repository.revokeSessionsByIds(sessionIds, revokedAt);
  }
}
