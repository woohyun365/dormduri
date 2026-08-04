import { Inject, Injectable } from '@nestjs/common';
import {
  AuthOperationsHealthService,
  type AuthOperationsHealthSnapshot,
} from '../auth/operations/health/auth-operations-health.service.js';
import {
  REALTIME_METRICS_READER_PORT,
  type RealtimeMetricsReaderPort,
} from '../realtime/realtime.tokens.js';
import { DatabaseHealthCheck } from './checks/database-health.check.js';
import { EmailProviderHealthCheck } from './checks/email-provider-health.check.js';
import { MigrationBaselineHealthCheck } from './checks/migration-baseline-health.check.js';
import { RuntimeConfigHealthCheck } from './checks/runtime-config-health.check.js';
import { SecretSourceHealthCheck } from './checks/secret-source-health.check.js';
import {
  createHealthBaseResponse,
  presentReadinessResponse,
  type HealthBaseResponse,
  type HealthReadinessResponse,
} from './presenters/health-response.presenter.js';

export type HealthStatusResponse = HealthBaseResponse;
export type { HealthReadinessResponse };

export interface RealtimeOperationsStatusResponse extends HealthBaseResponse {
  realtime: ReturnType<RealtimeMetricsReaderPort['snapshot']>;
}

export interface AuthOperationsStatusResponse extends HealthBaseResponse {
  auth: AuthOperationsHealthSnapshot;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseHealthCheck: DatabaseHealthCheck,
    private readonly runtimeConfigHealthCheck: RuntimeConfigHealthCheck,
    private readonly secretSourceHealthCheck: SecretSourceHealthCheck,
    private readonly migrationBaselineHealthCheck: MigrationBaselineHealthCheck,
    private readonly emailProviderHealthCheck: EmailProviderHealthCheck,
    @Inject(REALTIME_METRICS_READER_PORT)
    private readonly realtimeMetrics: RealtimeMetricsReaderPort,
    private readonly authOperationsHealth: AuthOperationsHealthService,
  ) {}

  getLiveness(): HealthStatusResponse {
    return createHealthBaseResponse();
  }

  async getReadiness(): Promise<HealthReadinessResponse> {
    const checks = await Promise.all([
      this.databaseHealthCheck.check(),
      this.runtimeConfigHealthCheck.check(),
      this.secretSourceHealthCheck.check(),
      this.migrationBaselineHealthCheck.check(),
      this.emailProviderHealthCheck.check(),
    ]);

    return presentReadinessResponse(checks);
  }

  getRealtimeOperations(): RealtimeOperationsStatusResponse {
    return {
      ...this.getLiveness(),
      realtime: this.realtimeMetrics.snapshot(),
    };
  }

  getAuthOperations(): AuthOperationsStatusResponse {
    return {
      ...this.getLiveness(),
      auth: this.authOperationsHealth.getSnapshot(),
    };
  }
}
