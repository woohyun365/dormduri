import { describe, expect, it } from 'vitest';
import { compileTrustedProxyPeers, normalizePeerIp } from './trusted-proxy-peer.js';

describe('trusted transport peers', () => {
  it.each([
    [' 192.0.2.1 ', '192.0.2.1'],
    ['::ffff:192.0.2.1', '192.0.2.1'],
    ['0:0:0:0:0:ffff:c000:201', '192.0.2.1'],
    ['2001:0DB8:0:0::1', '2001:db8::1'],
  ])('canonicalizes %s', (value, expected) => expect(normalizePeerIp(value)).toBe(expected));
  it.each([
    undefined,
    null,
    '',
    'localhost',
    '192.0.2.1:80',
    '[::1]',
    'fe80::1%eth0',
    '::1,::2',
    ['::1'],
    '1.2.3.004',
  ])('rejects %j', (value) => expect(normalizePeerIp(value)).toBeNull());
  it.each([
    '',
    'loopback',
    'uniquelocal',
    'linklocal',
    '0.0.0.0/0',
    '::/0',
    '10.0.0.1/',
    '10.0.0.1/+1',
    '10.0.0.1/-1',
    '10.0.0.1/0x10',
    '10.0.0.1/1e1',
    '10.0.0.1/24/1',
    '10.0.0.1/33',
    '::1/129',
    'fe80::1%lo/64',
  ])('rejects unsupported peer %s', (value) =>
    expect(() => compileTrustedProxyPeers([value])).toThrow(),
  );
  it('matches exact, subnet, IPv6 and mapped peers without broad private trust', () => {
    const profile = compileTrustedProxyPeers(['10.0.0.2', '192.0.2.0/24', '2001:db8::/64']);
    for (const ip of ['10.0.0.2', '::ffff:10.0.0.2', '192.0.2.90', '2001:0db8:0:0::1'])
      expect(profile.isTrustedPeer(ip)).toBe(true);
    for (const ip of ['10.0.0.3', '192.0.3.1', '2001:db8:1::1', undefined, 'unknown'])
      expect(profile.isTrustedPeer(ip)).toBe(false);
    expect(Object.isFrozen(profile.peers)).toBe(true);
    expect(() => compileTrustedProxyPeers([])).toThrow();
    expect(compileTrustedProxyPeers(['::ffff:192.0.2.0/120']).isTrustedPeer('192.0.2.1')).toBe(
      true,
    );
  });
});
