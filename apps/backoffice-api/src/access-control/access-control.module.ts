import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminIdentityModule } from '../admin-identity/admin-identity.module.js';
import { AdminSessionService } from '../admin-identity/session/admin-session.service.js';
import { AdminAuditWriter } from '../audit/admin-audit-writer.js';
import { AuditModule } from '../audit/audit.module.js';
import { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { BackofficeMetrics } from '../platform/observability/backoffice-metrics.js';
import { Clock } from '../platform/time/clock.js';
import { AdminAccessGuard } from './admin-access.guard.js';
import { ApprovalRequestsController } from './approval/approval-requests.controller.js';
import { ApprovalRequestsService } from './approval/approval-requests.service.js';
import { AccessRolesModule } from './roles/access-roles.module.js';
import { RoleAssignmentStore } from './roles/role-assignment.store.js';
import { RolesController } from './roles/roles.controller.js';

/** Roles, permissions, approval requests and the global default-deny guard (README §4). */
@Module({
  imports: [AdminIdentityModule, AuditModule, AccessRolesModule],
  controllers: [ApprovalRequestsController, RolesController],
  providers: [
    { provide: APP_GUARD, useClass: AdminAccessGuard },
    {
      provide: ApprovalRequestsService,
      useFactory: (
        prisma: BackofficeRuntimePrisma,
        audit: AdminAuditWriter,
        roles: RoleAssignmentStore,
        sessions: AdminSessionService,
        metrics: BackofficeMetrics,
        clock: Clock,
      ) => new ApprovalRequestsService(prisma, audit, roles, sessions, metrics, clock),
      inject: [
        BackofficeRuntimePrisma,
        AdminAuditWriter,
        RoleAssignmentStore,
        AdminSessionService,
        BackofficeMetrics,
        Clock,
      ],
    },
  ],
})
export class AccessControlModule {}
