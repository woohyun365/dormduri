import { Controller, Get, Header, Inject } from '@nestjs/common';
import { PublicRoute } from '../access-control/route-access.js';
import { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../platform/http/api-error.js';

/** Liveness and readiness for the host probe and the ready-failure alert. */
@Controller('health')
export class HealthController {
  constructor(@Inject(BackofficeRuntimePrisma) private readonly prisma: BackofficeRuntimePrisma) {}

  @Get('live')
  @PublicRoute()
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @PublicRoute()
  @Header('Cache-Control', 'no-store')
  async ready() {
    try {
      await this.prisma.databaseNow();
    } catch {
      throw new BackofficeApiError('internal_error', 'database is not ready');
    }
    return { status: 'ok' };
  }
}
