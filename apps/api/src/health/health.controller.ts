import { Controller, Get } from '@nestjs/common';
import {
  HealthService,
  type HealthStatusResponse,
  type RealtimeOperationsStatusResponse,
} from './health.service.js';
import { Public } from '../auth/auth-access.decorator.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getLiveness(): HealthStatusResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): Promise<HealthStatusResponse> {
    return this.healthService.getReadiness();
  }

  @Get('realtime')
  getRealtimeOperations(): RealtimeOperationsStatusResponse {
    return this.healthService.getRealtimeOperations();
  }
}
