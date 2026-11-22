import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  Res,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { PublicRoute } from '../../access-control/route-access.js';
import { BACKOFFICE_SETTINGS, type BackofficeSettings } from '../config/backoffice-settings.js';
import { BackofficeApiError } from '../http/api-error.js';
import { headerValue, type BackofficeRequest } from '../http/request-context.js';
import { BackofficeMetrics } from './backoffice-metrics.js';

/** `/internal/metrics` takes a bearer token (the same protection as the user API). */
@Injectable()
export class MetricsTokenGuard implements CanActivate {
  constructor(@Inject(BACKOFFICE_SETTINGS) private readonly settings: BackofficeSettings) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.settings.metricsBearerToken;
    if (!expected) {
      // Production requires the token at startup; only local runs reach this branch.
      return this.settings.env !== 'production';
    }
    const request = context.switchToHttp().getRequest<BackofficeRequest>();
    const value = Buffer.from(headerValue(request.headers, 'authorization') ?? '', 'utf8');
    const wanted = Buffer.from(`Bearer ${expected}`, 'utf8');
    if (value.length === wanted.length && timingSafeEqual(value, wanted)) {
      return true;
    }
    throw new BackofficeApiError('session_required', 'metrics token required');
  }
}

@Controller('internal/metrics')
export class MetricsController {
  constructor(@Inject(BackofficeMetrics) private readonly metrics: BackofficeMetrics) {}

  @Get()
  @PublicRoute()
  @UseGuards(MetricsTokenGuard)
  @Header('Cache-Control', 'no-store')
  async scrape(@Res({ passthrough: true }) response: ServerResponse): Promise<string> {
    response.setHeader('Content-Type', this.metrics.contentType());
    return this.metrics.render();
  }
}
