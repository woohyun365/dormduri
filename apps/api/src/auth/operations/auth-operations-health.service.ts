import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authOperationsConfig from '../../config/auth-operations.config.js';
import databaseConfig from '../../config/database.config.js';
import {
  calculatePrismaConnectionPoolBudget,
  type PrismaConnectionPoolBudget,
} from '../../platform/database/prisma.service.js';
import { evaluateAuthRedisGate, type AuthRedisGateSignals } from './auth-redis-gate.policy.js';
import {
  AuthOperationalMetricsService,
  type AuthOperationsMetricsSnapshot,
} from './auth-operational-metrics.service.js';

export interface AuthOperationsHealthSnapshot {
  metrics: AuthOperationsMetricsSnapshot;
  redisGate: ReturnType<typeof evaluateAuthRedisGate>;
  rdsPoolBudget: PrismaConnectionPoolBudget;
  alerts: string[];
}

export interface AuthOperationsHealthInput {
  redisSignals?: AuthRedisGateSignals;
  rdsPoolUtilizationRatio?: number | null;
}

@Injectable()
export class AuthOperationsHealthService {
  constructor(
    private readonly metrics: AuthOperationalMetricsService,
    @Inject(authOperationsConfig.KEY)
    private readonly authOpsSettings: ConfigType<typeof authOperationsConfig>,
    @Inject(databaseConfig.KEY)
    private readonly databaseSettings: ConfigType<typeof databaseConfig>,
  ) {}

  getSnapshot(input: AuthOperationsHealthInput = {}): AuthOperationsHealthSnapshot {
    const redisGate = evaluateAuthRedisGate(input.redisSignals ?? {}, {
      authP95MsThreshold: this.authOpsSettings.redisTriggerAuthP95Ms,
      authWriteIopsThreshold: this.authOpsSettings.redisTriggerAuthWriteIops,
      throttleBypassPerHourThreshold: this.authOpsSettings.redisTriggerThrottleBypassPerHour,
      degradeMode: this.authOpsSettings.redisDegradeMode,
    });
    this.metrics.recordRedisGate(redisGate);

    const metrics = this.metrics.snapshot();
    const rdsPoolBudget = calculatePrismaConnectionPoolBudget(this.databaseSettings, {
      alertRatio: this.authOpsSettings.rdsPoolUtilizationAlertRatio,
    });
    const alerts: string[] = [];

    if (metrics.cleanup.lastCleanupLagSeconds >= this.authOpsSettings.cleanupLagAlertSeconds) {
      alerts.push('auth_cleanup_lag');
    }

    if (
      input.rdsPoolUtilizationRatio !== undefined &&
      input.rdsPoolUtilizationRatio !== null &&
      input.rdsPoolUtilizationRatio >= this.authOpsSettings.rdsPoolUtilizationAlertRatio
    ) {
      alerts.push('rds_connection_pool_budget');
    }

    if (redisGate.decision === 'redis_candidate') {
      alerts.push('auth_redis_gate_triggered');
    }

    return {
      metrics,
      redisGate,
      rdsPoolBudget,
      alerts,
    };
  }
}
