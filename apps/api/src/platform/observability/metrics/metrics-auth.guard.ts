import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../observability.config.js';

export const METRICS_BEARER_TOKEN_ENV = 'METRICS_BEARER_TOKEN';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.settings.metricsEnabled) {
      throw new NotFoundException('metrics endpoint disabled');
    }

    const token = this.settings.metricsBearerToken;
    if (!token && this.settings.env !== 'production') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = this.resolveAuthorization(request.headers.authorization);
    if (authorization === `Bearer ${token}`) {
      return true;
    }

    throw new UnauthorizedException(`${METRICS_BEARER_TOKEN_ENV} is required`);
  }

  private resolveAuthorization(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return this.resolveAuthorization(value[0]);
    }

    return typeof value === 'string' ? value.trim() : null;
  }
}
