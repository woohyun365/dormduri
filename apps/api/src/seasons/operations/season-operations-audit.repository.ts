import { Injectable } from '@nestjs/common';
import type { Prisma, SeasonOperationAuditAction } from '../../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonOperationSnapshotSource } from './season-operations.mapper.js';
import { toSeasonOperationsSnapshot } from './season-operations.mapper.js';

export type SeasonOperationsDbClient = Prisma.TransactionClient | PrismaService;

export interface AppendSeasonOperationAuditInput {
  client: SeasonOperationsDbClient;
  action: SeasonOperationAuditAction;
  actor: AuthenticatedUserContext;
  seasonId: string;
  reason?: string | null;
  previousSeason: SeasonOperationSnapshotSource;
  nextSeason: SeasonOperationSnapshotSource;
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class SeasonOperationsAuditRepository {
  append(input: AppendSeasonOperationAuditInput) {
    return input.client.seasonOperationAuditEvent.create({
      data: {
        seasonId: input.seasonId,
        campusCode: input.nextSeason.campusCode,
        action: input.action,
        actorUserId: input.actor.id,
        actorCapabilities: [...(input.actor.capabilities ?? [])],
        reason: input.reason ?? null,
        previousSnapshot: toSeasonOperationsSnapshot(input.previousSeason),
        nextSnapshot: toSeasonOperationsSnapshot(input.nextSeason),
        metadata: input.metadata ?? undefined,
      },
      select: { id: true },
    });
  }
}
