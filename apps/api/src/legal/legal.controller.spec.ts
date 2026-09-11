import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { AUTH_ACCESS_METADATA_KEY } from '../auth/access/auth-access.decorator.js';
import { LegalController } from './legal.controller.js';

const NEST_CONTROLLER_PATH_METADATA = 'path';
const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';

type RouteHandler = object & ((...args: never[]) => unknown);

function getLegalControllerHandler(methodName: keyof LegalController): RouteHandler {
  const descriptor = Object.getOwnPropertyDescriptor(LegalController.prototype, methodName);
  const handler: unknown = descriptor?.value;

  if (typeof handler !== 'function') {
    throw new Error(`Expected ${methodName} handler`);
  }

  return handler as RouteHandler;
}

describe('LegalController', () => {
  const legalService = {
    getActiveDocument: vi.fn(),
    getActiveBundle: vi.fn(),
  };
  const controller = new LegalController(legalService as never);

  it('controller는 public /api/legal route로 노출된다', () => {
    expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, LegalController)).toBe('public');
    expect(Reflect.getMetadata(NEST_CONTROLLER_PATH_METADATA, LegalController)).toBe('api/legal');
  });

  it('active bundle route는 /api/legal/documents/active-bundle로 노출된다', async () => {
    legalService.getActiveBundle.mockResolvedValue({ termsOfService: { id: 'terms' } });
    const handler = getLegalControllerHandler('getActiveBundle');

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('documents/active-bundle');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.GET);

    await expect(controller.getActiveBundle()).resolves.toEqual({
      termsOfService: { id: 'terms' },
    });
    expect(legalService.getActiveBundle).toHaveBeenCalledWith();
  });

  it('active document route는 parsed kind를 service로 위임한다', async () => {
    legalService.getActiveDocument.mockResolvedValue({ id: 'privacy' });
    const handler = getLegalControllerHandler('getActiveDocument');

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('documents/:kind/active');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.GET);

    await expect(controller.getActiveDocument('PRIVACY_POLICY')).resolves.toEqual({
      id: 'privacy',
    });
    expect(legalService.getActiveDocument).toHaveBeenCalledWith('PRIVACY_POLICY');
  });
});
