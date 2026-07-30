import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuthMailEnvelopeWriter } from './auth-mail-envelope-writer.service.js';
import { AuthMailOutboxRepository } from './auth-mail-outbox.repository.js';

const PASSWORD_CHANGED_MAIL_EXPIRY_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class AuthMailOutboxWriter {
  constructor(
    private readonly envelopeWriter: AuthMailEnvelopeWriter,
    private readonly repository: AuthMailOutboxRepository,
  ) {}

  async appendPasswordChanged(
    tx: Prisma.TransactionClient,
    input: { targetUserId: string; email: string; now: Date },
  ): Promise<void> {
    const envelope = this.envelopeWriter.encrypt({
      schemaVersion: 1,
      mailKind: 'PASSWORD_CHANGED',
      email: input.email,
    });
    await this.repository.appendPasswordChanged(tx, {
      targetUserId: input.targetUserId,
      envelope,
      now: input.now,
      expiresAt: new Date(input.now.getTime() + PASSWORD_CHANGED_MAIL_EXPIRY_MS),
    });
  }
}
