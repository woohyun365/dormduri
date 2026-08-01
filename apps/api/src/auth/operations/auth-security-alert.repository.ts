import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RetentionWorkerPrismaService } from '../../platform/database/prisma.service.js';
import type { AuthSecurityAlertEvent } from '../security-events/security-alert.policy.js';

@Injectable()
export class AuthSecurityAlertRepository {
  async readSignals(
    prisma: RetentionWorkerPrismaService,
    input: { since: Date; now: Date; limit?: number },
  ): Promise<{ events: AuthSecurityAlertEvent[]; mailOutboxLagSeconds: number }> {
    const limit = Math.max(1, Math.min(input.limit ?? 1_000, 1_000));
    const [events, oldestPendingMail] = await Promise.all([
      prisma.authSecurityEvent.findMany({
        where: {
          createdAt: { gte: input.since, lte: input.now },
          type: {
            in: ['LOGIN_FAILURE', 'VERIFICATION_CODE_REQUESTED', 'MAIL_SEND_FAILURE'],
          },
        },
        select: {
          type: true,
          emailHash: true,
          createdAt: true,
          metadata: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      prisma.authMailOutboxEvent.findFirst({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          availableAt: { lte: input.now },
          expiresAt: { gt: input.now },
        },
        select: { createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      events: events.map((event) => ({
        type: event.type,
        subjectKey: event.emailHash,
        createdAt: event.createdAt,
        metadata: toMetadata(event.metadata),
      })),
      mailOutboxLagSeconds: oldestPendingMail
        ? Math.max(0, (input.now.getTime() - oldestPendingMail.createdAt.getTime()) / 1_000)
        : 0,
    };
  }
}

function toMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
