import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/database/prisma.service.js';
import {
  AuthOperationsHealthService,
  type AuthOperationsHealthSnapshot,
} from '../auth/operations/auth-operations-health.service.js';
import {
  REALTIME_METRICS_READER_PORT,
  type RealtimeMetricsReaderPort,
} from '../realtime/realtime.tokens.js';

interface HealthBaseResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface HealthStatusResponse extends HealthBaseResponse {
  checks?: {
    database: {
      status: 'up';
      checkedAt: string;
    };
  };
}

export interface RealtimeOperationsStatusResponse extends HealthBaseResponse {
  realtime: ReturnType<RealtimeMetricsReaderPort['snapshot']>;
}

export interface AuthOperationsStatusResponse extends HealthBaseResponse {
  auth: AuthOperationsHealthSnapshot;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REALTIME_METRICS_READER_PORT)
    private readonly realtimeMetrics: RealtimeMetricsReaderPort,
    private readonly authOperationsHealth: AuthOperationsHealthService,
  ) {}

  getLiveness(): HealthStatusResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<HealthStatusResponse> {
    const databaseNow = await this.prisma.getDatabaseNow();

    return {
      ...this.getLiveness(),
      checks: {
        database: {
          status: 'up',
          checkedAt: databaseNow.toISOString(),
        },
      },
    };
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
