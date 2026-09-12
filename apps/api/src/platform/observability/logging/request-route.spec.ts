import { describe, expect, it } from 'vitest';
import { resolveRequestRouteTemplate } from './request-route.js';

describe('request route-template extraction', () => {
  it.each([
    [{}, 'UNKNOWN_ROUTE'],
    [{ route: { path: [] } }, 'UNKNOWN_ROUTE'],
    [{ route: { path: 123 } }, 'UNKNOWN_ROUTE'],
    [{ route: { path: '/' } }, '/'],
    [{ baseUrl: '/api/', route: { path: '/users/:id' } }, '/api/users/:id'],
    [{ baseUrl: 'api', route: { path: [false, 'users/:id', '/other'] } }, '/api/users/:id'],
    [{ baseUrl: 123, route: { path: 'users/:id' } }, '/users/:id'],
  ])('keeps bounded labels for %j', (source, expected) => {
    expect(resolveRequestRouteTemplate(source)).toBe(expected);
  });
});
