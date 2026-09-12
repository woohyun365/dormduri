import { describe, expect, it, vi } from 'vitest';
import { resolveAuthRequestContext } from './auth-request-context.decorator.js';

describe('auth HTTP metadata extraction', () => {
  it.each([
    [{ headers: {} }, { requestIp: null, userAgent: null }],
    [
      { headers: { 'user-agent': 'header-agent' }, ip: 'ip' },
      { requestIp: 'ip', userAgent: 'header-agent' },
    ],
    [{ headers: { 'user-agent': ['first', 'second'] } }, { requestIp: null, userAgent: null }],
    [
      { headers: { 'user-agent': '' }, ip: '' },
      { requestIp: '', userAgent: '' },
    ],
    [
      { headers: { 'user-agent': '  ' }, ip: '  ' },
      { requestIp: '  ', userAgent: '  ' },
    ],
    [
      { headers: { 'user-agent': 'header' }, get: () => 'method' },
      { requestIp: null, userAgent: 'method' },
    ],
    [
      { headers: { 'user-agent': 'header' }, get: () => undefined },
      { requestIp: null, userAgent: null },
    ],
    [
      { headers: { 'user-agent': 'header' }, get: () => '' },
      { requestIp: null, userAgent: '' },
    ],
  ])('preserves metadata from %j', (source, expected) => {
    expect(resolveAuthRequestContext(source)).toEqual(expected);
  });

  it('calls the native getter with its receiver and canonical header name', () => {
    const source = {
      headers: { 'user-agent': 'agent' },
      get: vi.fn(function (this: { headers: { 'user-agent': string } }, name: string) {
        expect(name).toBe('user-agent');
        return this.headers['user-agent'];
      }),
    };
    expect(resolveAuthRequestContext(source)).toEqual({ requestIp: null, userAgent: 'agent' });
    expect(source.get).toHaveBeenCalledTimes(1);
  });
});
