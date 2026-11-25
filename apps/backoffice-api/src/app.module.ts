import { Module, type DynamicModule } from '@nestjs/common';
import { AccessControlModule } from './access-control/access-control.module.js';
import { AdminIdentityModule } from './admin-identity/admin-identity.module.js';
import { AuditModule } from './audit/audit.module.js';
import { HealthController } from './health/health.controller.js';
import { LegalModule } from './legal/legal.module.js';
import {
  MetricsController,
  MetricsTokenGuard,
} from './platform/observability/metrics.controller.js';
import { PlatformModule, type PlatformOptions } from './platform/platform.module.js';

@Module({})
export class BackofficeAppModule {
  static register(options: PlatformOptions): DynamicModule {
    return {
      module: BackofficeAppModule,
      imports: [
        PlatformModule.register(options),
        AuditModule,
        AdminIdentityModule,
        AccessControlModule,
        LegalModule,
      ],
      controllers: [HealthController, MetricsController],
      providers: [MetricsTokenGuard],
    };
  }
}
