import { Module } from '@nestjs/common';
import { AccessRolesModule } from '../access-control/roles/access-roles.module.js';
import { RoleAssignmentStore } from '../access-control/roles/role-assignment.store.js';
import { AdminAuditWriter } from '../audit/admin-audit-writer.js';
import { AuditModule } from '../audit/audit.module.js';
import { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { BackofficeMetrics } from '../platform/observability/backoffice-metrics.js';
import { Clock } from '../platform/time/clock.js';
import { LegalController } from './legal.controller.js';
import { LegalDraftsService } from './legal-drafts.service.js';
import { LegalRequestsService } from './legal-requests.service.js';

/** Legal drafts, publish and withdraw requests and their decisions (README §8). */
@Module({
  imports: [AuditModule, AccessRolesModule],
  controllers: [LegalController],
  providers: [
    {
      provide: LegalDraftsService,
      useFactory: (prisma: BackofficeRuntimePrisma, audit: AdminAuditWriter, clock: Clock) =>
        new LegalDraftsService(prisma, audit, clock),
      inject: [BackofficeRuntimePrisma, AdminAuditWriter, Clock],
    },
    {
      provide: LegalRequestsService,
      useFactory: (
        prisma: BackofficeRuntimePrisma,
        audit: AdminAuditWriter,
        roles: RoleAssignmentStore,
        metrics: BackofficeMetrics,
        clock: Clock,
      ) => new LegalRequestsService(prisma, audit, roles, metrics, clock),
      inject: [
        BackofficeRuntimePrisma,
        AdminAuditWriter,
        RoleAssignmentStore,
        BackofficeMetrics,
        Clock,
      ],
    },
  ],
})
export class LegalModule {}
