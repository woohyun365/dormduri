import { describe, expect, it } from 'vitest';
import { hasAuthRequestContext, normalizeAuthRequestContext } from './auth-request-context.js';

describe('pure auth request context', () => {
  it.each([
    [undefined, undefined, { requestIp: null, userAgent: null }],
    [null, 'agent', { requestIp: null, userAgent: 'agent' }],
    ['  ', '', { requestIp: '  ', userAgent: '' }],
    [{ requestIp: 'ip' }, 'ignored', { requestIp: 'ip', userAgent: null }],
    [{ userAgent: 'agent' }, 'ignored', { requestIp: null, userAgent: 'agent' }],
    [{ requestIp: '', userAgent: null }, 'ignored', { requestIp: '', userAgent: null }],
    [{}, 'fallback', { requestIp: null, userAgent: 'fallback' }],
  ])('normalizes %j without changing nullish/empty semantics', (input, agent, expected) => {
    expect(normalizeAuthRequestContext(input, agent)).toEqual(expected);
  });

  it.each([
    [undefined, false],
    [{}, false],
    [{ requestIp: '', userAgent: null }, false],
    [{ requestIp: ' ' }, true],
    [{ userAgent: 'agent' }, true],
  ])('presence of %j is %s', (context, expected) => {
    expect(hasAuthRequestContext(context)).toBe(expected);
  });
});
