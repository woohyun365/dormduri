import { describe, expect, it } from 'vitest';
import { Controller, Get, type ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { DEFAULT_METRICS_ROUTE } from '../observability.config.js';
import {
  NEST_PATH_METADATA,
  readRecordedRequestRouteTemplate,
  recordRequestRouteTemplate,
  resolveExecutionRouteTemplate,
  resolveRouteTemplate,
} from './request-route.js';
import { RequestRouteTemplateGuard } from './request-route-template.guard.js';

@Controller('api/users')
class UsersProbeController {
  @Get(':id')
  findOne() {}

  @Get()
  list() {}
}

@Controller()
class RootProbeController {
  @Get('api/support/faq/:faqId')
  faq() {}
}

@Controller(DEFAULT_METRICS_ROUTE)
class MetricsProbeController {
  @Get()
  scrape() {}
}

function contextFor(
  controller: abstract new (...args: never[]) => unknown,
  handlerName: string,
  request: object = {},
  type = 'http',
): ExecutionContext {
  const handler: unknown = Reflect.get(controller.prototype as object, handlerName);
  return {
    getClass: () => controller,
    getHandler: () => handler,
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('request route-template extraction', () => {
  it('reads the same metadata key the Nest route decorators write', () => {
    expect(NEST_PATH_METADATA).toBe(PATH_METADATA);
  });

  it.each([
    [undefined, undefined, 'UNKNOWN_ROUTE'],
    ['api', [], 'UNKNOWN_ROUTE'],
    ['api', 123, 'UNKNOWN_ROUTE'],
    ['/', '/', '/'],
    ['/api/', '/users/:id', '/api/users/:id'],
    ['/api/', '/', '/api'],
    ['api', 'users/:id/', '/api/users/:id'],
    ['api', [false, 'users/:id', '/other'], '/api/users/:id'],
    [123, 'users/:id', '/users/:id'],
    [['api/users', 'other'], '/', '/api/users'],
  ])('keeps bounded labels for controller %j and handler %j', (controller, handler, expected) => {
    expect(resolveRouteTemplate(controller, handler)).toBe(expected);
  });

  it.each([
    [UsersProbeController, 'findOne', '/api/users/:id'],
    [UsersProbeController, 'list', '/api/users'],
    [RootProbeController, 'faq', '/api/support/faq/:faqId'],
    [MetricsProbeController, 'scrape', '/internal/metrics'],
  ])(
    'joins Nest controller and handler path metadata into %s routes',
    (controller, handler, expected) => {
      expect(resolveExecutionRouteTemplate(contextFor(controller, handler), new Reflector())).toBe(
        expected,
      );
    },
  );

  it('reads only a template recorded on the same request', () => {
    const request = {};
    expect(readRecordedRequestRouteTemplate(request)).toBe('UNKNOWN_ROUTE');
    expect(readRecordedRequestRouteTemplate(undefined)).toBe('UNKNOWN_ROUTE');
    recordRequestRouteTemplate(request, '/api/users/:id');
    expect(readRecordedRequestRouteTemplate(request)).toBe('/api/users/:id');
    expect(readRecordedRequestRouteTemplate({})).toBe('UNKNOWN_ROUTE');
    expect(Object.keys(request)).toEqual([]);
  });
});

describe('RequestRouteTemplateGuard', () => {
  it('always passes and records the HTTP route template for the exception filter', () => {
    const guard = new RequestRouteTemplateGuard(new Reflector());
    const request = {};
    expect(guard.canActivate(contextFor(UsersProbeController, 'findOne', request))).toBe(true);
    expect(readRecordedRequestRouteTemplate(request)).toBe('/api/users/:id');
  });

  it('passes other transports without touching the request', () => {
    const guard = new RequestRouteTemplateGuard(new Reflector());
    const request = {};
    expect(guard.canActivate(contextFor(UsersProbeController, 'findOne', request, 'ws'))).toBe(
      true,
    );
    expect(readRecordedRequestRouteTemplate(request)).toBe('UNKNOWN_ROUTE');
  });
});
