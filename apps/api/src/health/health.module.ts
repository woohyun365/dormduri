import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { AuthOperationsModule } from '../auth/operations/auth-operations.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DatabaseHealthCheck } from './checks/database-health.check.js';
import { EmailProviderHealthCheck } from './checks/email-provider-health.check.js';
import { MigrationBaselineHealthCheck } from './checks/migration-baseline-health.check.js';
import { RuntimeConfigHealthCheck } from './checks/runtime-config-health.check.js';
import { SecretSourceHealthCheck } from './checks/secret-source-health.check.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [PrismaModule, ChatModule, AuthOperationsModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthCheck,
    RuntimeConfigHealthCheck,
    SecretSourceHealthCheck,
    MigrationBaselineHealthCheck,
    EmailProviderHealthCheck,
    HealthService,
  ],
})
export class HealthModule {}
