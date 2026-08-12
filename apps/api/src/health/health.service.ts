import { Injectable } from '@nestjs/common';
import { DatabaseHealthCheck } from './checks/database-health.check.js';
import { RuntimeBootstrapHealthCheck } from './checks/runtime-bootstrap-health.check.js';
import { HealthObservabilityService } from './health-observability.service.js';
import {
  createHealthBaseResponse,
  presentReadinessResponse,
  type HealthBaseResponse,
  type HealthReadinessResponse,
} from './presenters/health-response.presenter.js';

export type HealthStatusResponse = HealthBaseResponse;
export type { HealthReadinessResponse };

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseHealthCheck: DatabaseHealthCheck,
    private readonly runtimeBootstrapHealthCheck: RuntimeBootstrapHealthCheck,
    private readonly observability: HealthObservabilityService,
  ) {}

  getLiveness(): HealthStatusResponse {
    return createHealthBaseResponse();
  }

  async getReadiness(): Promise<HealthReadinessResponse> {
    const startedAtMs = Date.now();
    const checks = await Promise.all([
      this.databaseHealthCheck.check(),
      this.runtimeBootstrapHealthCheck.check(),
    ]);
    this.observability.recordReadiness(checks, Math.max(0, Date.now() - startedAtMs));

    return presentReadinessResponse(checks);
  }
}
