import { Injectable, Logger } from '@nestjs/common';
import { AuthSecurityEventRepository } from './repositories/security-event.repository.js';
import type { AuthSecurityEventInput } from './auth-security-event.types.js';
import {
  defaultAuthSecurityEventSeverity,
  hashAuthSecurityEventDimension,
  sanitizeAuthSecurityEventMetadata,
} from './policies/security-event-sanitizer.js';

@Injectable()
export class AuthSecurityEventService {
  private readonly logger = new Logger(AuthSecurityEventService.name);

  constructor(private readonly repository: AuthSecurityEventRepository) {}

  async record(input: AuthSecurityEventInput): Promise<void> {
    await this.repository.create({
      type: input.type,
      severity: input.severity ?? defaultAuthSecurityEventSeverity(input.type),
      actorUserId: input.actorUserId ?? undefined,
      targetUserId: input.targetUserId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      emailHash: hashAuthSecurityEventDimension(input.emailNormalized),
      requestIpHash: hashAuthSecurityEventDimension(input.requestIp),
      userAgentHash: hashAuthSecurityEventDimension(input.userAgent),
      metadata: sanitizeAuthSecurityEventMetadata(input.metadata),
    });
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
