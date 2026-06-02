import { Injectable } from '@nestjs/common';
import { ChatRealtimeMetricsService } from '../chat/realtime/chat-realtime.metrics.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

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
  realtime: ReturnType<ChatRealtimeMetricsService['snapshot']>;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeMetrics: ChatRealtimeMetricsService,
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
}
