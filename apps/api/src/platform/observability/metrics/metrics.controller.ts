import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../auth/access/auth-access.decorator.js';
import { DEFAULT_METRICS_ROUTE } from '../../../config/observability.config.js';
import { MetricsAuthGuard } from './metrics-auth.guard.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';

@Public()
@Controller(DEFAULT_METRICS_ROUTE)
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly registry: PrometheusRegistryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res({ passthrough: true }) response: Response): Promise<string> {
    response.type(this.registry.getContentType());
    return this.registry.metrics();
  }
}
