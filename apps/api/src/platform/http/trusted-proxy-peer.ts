import { BlockList, isIP, SocketAddress } from 'node:net';

/** One transport IP, never a hostname, socket endpoint, zone or forwarding chain. */
export function normalizePeerIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const address = value.trim();
  if (address.includes('%')) return null;
  const family = isIP(address);
  if (!family) return null;
  const canonical = new SocketAddress({ address, family: family === 4 ? 'ipv4' : 'ipv6' }).address;
  return canonical.startsWith('::ffff:') ? canonical.slice(7) : canonical;
}

/** Closed matcher: callers cannot mutate its BlockList after configuration assembly. */
export function compileTrustedProxyPeers(values: readonly string[]) {
  if (values.length === 0) throw new Error('[config] Explicit trusted proxy peers are required.');
  const matcher = new BlockList();
  const peers = values.map((value) => {
    const [address = '', prefix, extra] = value.trim().split('/');
    const family = isIP(address);
    const max = family === 4 ? 32 : 128;
    if (
      !family ||
      address.includes('%') ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/u.test(prefix) || Number(prefix) < 1 || Number(prefix) > max))
    ) {
      throw new Error('[config] Trusted proxy peers must be explicit IPs or non-catch-all CIDRs.');
    }
    const type = family === 4 ? 'ipv4' : 'ipv6';
    const canonical = new SocketAddress({ address, family: type }).address;
    if (prefix === undefined) matcher.addAddress(canonical, type);
    else matcher.addSubnet(canonical, Number(prefix), type);
    return prefix === undefined ? canonical : `${canonical}/${Number(prefix)}`;
  });
  return Object.freeze({
    peers: Object.freeze([...new Set(peers)]),
    isTrustedPeer(value: unknown): boolean {
      const address = normalizePeerIp(value);
      return address !== null && matcher.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
    },
  });
}
