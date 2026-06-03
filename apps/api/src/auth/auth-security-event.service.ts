import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  AuthSecurityEventInput,
  AuthSecurityEventSeverity,
} from './auth-security-event.types.js';

const SENSITIVE_METADATA_KEY_PATTERN = /password|token|secret|code|credential|hash/i;

function hashDimension(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return createHash('sha256').update(normalized).digest('hex');
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return undefined;
  }

  const safeEntries = Object.entries(metadata).filter(([key, value]) => {
    return !SENSITIVE_METADATA_KEY_PATTERN.test(key) && isJsonPrimitive(value);
  });

  if (safeEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(safeEntries) as Prisma.InputJsonObject;
}

function defaultSeverity(type: AuthSecurityEventInput['type']): AuthSecurityEventSeverity {
  switch (type) {
    case 'LOGIN_LOCKOUT':
    case 'MAIL_SEND_FAILURE':
    case 'OPAQUE_TRANSPORT_REJECTED':
    case 'SESSION_TOKEN_REUSE_DETECTED':
    case 'VERIFICATION_CODE_VERIFY_FAILURE':
      return 'WARNING';
    default:
      return 'INFO';
  }
}

@Injectable()
export class AuthSecurityEventService {
  private readonly logger = new Logger(AuthSecurityEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuthSecurityEventInput): Promise<void> {
    await this.prisma.authSecurityEvent.create({
      data: {
        type: input.type,
        severity: input.severity ?? defaultSeverity(input.type),
        actorUserId: input.actorUserId ?? undefined,
        targetUserId: input.targetUserId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        emailHash: hashDimension(input.emailNormalized),
        requestIpHash: hashDimension(input.requestIp),
        userAgentHash: hashDimension(input.userAgent),
        metadata: sanitizeMetadata(input.metadata),
      },
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
