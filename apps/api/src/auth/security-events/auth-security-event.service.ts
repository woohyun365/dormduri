import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authConfig from '../config/auth.config.js';
import { AuthSecurityEventRepository } from './auth-security-event.repository.js';
import type { AuthSecurityEventInput } from './auth-security-event.types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  defaultAuthSecurityEventSeverity,
  hashAuthSecurityEventDimension,
  sanitizeAuthSecurityEventMetadata,
} from './security-event-sanitizer.js';

@Injectable()
export class AuthSecurityEventService {
  private readonly logger = new Logger(AuthSecurityEventService.name);

  constructor(
    private readonly repository: AuthSecurityEventRepository,
    @Inject(authConfig.KEY)
    private readonly authSettings: ConfigType<typeof authConfig>,
  ) {}

  async record(input: AuthSecurityEventInput): Promise<void> {
    await this.repository.create(this.toPersistenceData(input));
  }

  async recordInTransaction(
    tx: Prisma.TransactionClient,
    input: AuthSecurityEventInput,
  ): Promise<void> {
    await this.repository.create(this.toPersistenceData(input), tx);
  }

  toPersistenceData(input: AuthSecurityEventInput): Prisma.AuthSecurityEventCreateInput {
    return {
      type: input.type,
      severity: input.severity ?? defaultAuthSecurityEventSeverity(input.type),
      actorUserId: input.actorUserId ?? undefined,
      targetUserId: input.targetUserId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      emailHash: hashAuthSecurityEventDimension(
        'subject',
        input.emailNormalized,
        this.authSettings.persistenceHmacSecret,
        this.authSettings.persistenceHmacKeyVersion,
      ),
      requestIpHash: hashAuthSecurityEventDimension(
        'request-ip',
        input.requestIp,
        this.authSettings.persistenceHmacSecret,
        this.authSettings.persistenceHmacKeyVersion,
      ),
      userAgentHash: hashAuthSecurityEventDimension(
        'user-agent',
        input.userAgent,
        this.authSettings.persistenceHmacSecret,
        this.authSettings.persistenceHmacKeyVersion,
      ),
      metadata: sanitizeAuthSecurityEventMetadata(input.metadata),
    };
  }

  async recordSafely(input: AuthSecurityEventInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.warn(
        `[auth-security-event] failed to record event type=${input.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export async function recordAuthSecurityEventSafely(
  securityEvents: AuthSecurityEventService | undefined,
  input: AuthSecurityEventInput,
) {
  if (!securityEvents) {
    return;
  }

  if (typeof securityEvents.recordSafely === 'function') {
    await securityEvents.recordSafely(input);
    return;
  }

  await securityEvents.record(input);
}
