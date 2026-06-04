import { Controller, Get } from '@nestjs/common';
import {
  HealthService,
  type AuthOperationsStatusResponse,
  type HealthStatusResponse,
  type RealtimeOperationsStatusResponse,
} from './health.service.js';
import { Public, RequireCapability } from '../auth/access/auth-access.decorator.js';

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

  @Get('auth')
  @RequireCapability('admin:operations:health:read')
  getAuthOperations(): AuthOperationsStatusResponse {
    return this.healthService.getAuthOperations();
  }
}
