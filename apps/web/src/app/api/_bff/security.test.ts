import { describe, expect, it } from 'vitest';
import { filterForwardHeaderRecord, normalizeForwardedClientIp } from './security';

describe('BFF single forwarded client IP', () => {
  it.each([
    ['203.0.113.30', '203.0.113.30'],
    [' 203.0.113.31 ', '203.0.113.31'],
    ['2001:0DB8:0:0:0:0:0:1', '2001:db8::1'],
    ['2001:db8::2', '2001:db8::2'],
    ['::1', '::1'],
    ['::ffff:203.0.113.30', '203.0.113.30'],
    ['0:0:0:0:0:FFFF:cb00:711e', '203.0.113.30'],
  ])('%s는 하나의 canonical IP %s로 정규화한다', (input, expected) => {
    expect(normalizeForwardedClientIp(input)).toBe(expected);
  });

  it.each(
    [
      undefined,
      null,
      '',
      '   ',
      '203.0.113.30, 198.51.100.1',
      '203.0.113.30, 203.0.113.30',
      ',203.0.113.30',
      '203.0.113.30,',
      ['203.0.113.30'],
      ['203.0.113.30', '198.51.100.1'],
      'localhost',
      '203.0.113.30:443',
      '[2001:db8::1]',
      '[2001:db8::1]:443',
      'fe80::1%eth0',
      '192.168.001.1',
      '256.0.0.1',
      '203.0.113.30\n198.51.100.1',
    ].map((input) => ({ input })),
  )('단일 IP가 아닌 $input는 생략한다', ({ input }) => {
    expect(normalizeForwardedClientIp(input)).toBeUndefined();
  });

  it('임의 extra의 reserved forwarding 이름은 대소문자와 무관하게 제거한다', () => {
    expect(
      filterForwardHeaderRecord(
        {
          'x-forwarded-for': '198.51.100.1',
          'X-Forwarded-For': '198.51.100.2',
          'X-Real-IP': '198.51.100.3',
          Forwarded: 'for=198.51.100.4',
          'X-Forwarded-Host': 'forged.example',
          'X-Forwarded-Proto': 'https',
          'x-request-id': 'request-1',
          Authorization: 'Bearer cookie-token',
          'X-Auth-Verification-Grant': 'grant',
          'user-agent': 'vitest',
          'Content-Type': 'application/json',
        },
        { allowAuthorization: true },
      ),
    ).toEqual({
      'x-request-id': 'request-1',
      Authorization: 'Bearer cookie-token',
      'X-Auth-Verification-Grant': 'grant',
      'user-agent': 'vitest',
      'Content-Type': 'application/json',
    });
  });
});
