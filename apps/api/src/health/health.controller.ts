import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  HealthService,
  type HealthReadinessResponse,
  type HealthStatusResponse,
} from './health.service.js';
import { Public } from '../auth/access/auth-access.decorator.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  @Get()
  getLiveness(): HealthStatusResponse {
    return this.healthService.getLiveness();
  }

  @Get('live')
  getLive(): HealthStatusResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(
    @Res({ passthrough: true }) response: unknown,
  ): Promise<HealthReadinessResponse> {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status !== 'ok') {
      this.adapterHost.httpAdapter.status(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
