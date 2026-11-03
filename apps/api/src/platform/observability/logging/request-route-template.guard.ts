import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { recordRequestRouteTemplate, resolveExecutionRouteTemplate } from './request-route.js';

/**
 * Always-passing global guard that records the matched route template on the request.
 * The HTTP adapter does not expose the matched route, so this is the earliest point with
 * route metadata. ObservabilityModule registers it before AuthModule's guards, so the
 * exception log of a guard or throttle rejection still carries the template.
 */
@Injectable()
export class RequestRouteTemplateGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() === 'http') {
      recordRequestRouteTemplate(
        context.switchToHttp().getRequest<object>(),
        resolveExecutionRouteTemplate(context, this.reflector),
      );
    }
    return true;
  }
}
