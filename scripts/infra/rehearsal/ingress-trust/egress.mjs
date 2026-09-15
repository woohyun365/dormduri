// Synthetic peer only: no provider/DB credentials, no host firewall mutation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { BlockList, isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateEgress(input, networks = {}) {
  assert.ok(input && typeof input === 'object', 'Explicit synthetic egress configuration required');
  const privateIps = new BlockList();
  for (const [ip, prefix] of [
    ['10.0.0.0', 8],
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
  ])
    privateIps.addSubnet(ip, prefix);
  for (const key of ['address', 'sourceAddress']) {
    assert.ok(
      isIP(input[key]) === 4 && privateIps.check(input[key]),
      'Private literal IPv4 required',
    );
    for (const subnet of Object.values(networks)) {
      const [ip, prefix] = subnet.split('/');
      if (isIP(ip) !== 4) continue;
      const occupied = new BlockList();
      occupied.addSubnet(ip, Number(prefix));
      assert.ok(!occupied.check(input[key]), 'Peer must be outside fixture networks');
    }
  }
  assert.notEqual(input.address, input.sourceAddress, 'Peer cannot be the daemon host');
  assert.ok(Number.isInteger(input.port) && input.port >= 1024 && input.port <= 65535);
  assert.match(input.nonce ?? '', /^[a-f0-9]{32}$/u, 'Per-run synthetic nonce required');
  return input;
}

export function peerResponse(input, request) {
  const service = ['api', 'web'].find((name) => request.url === `/${input.nonce}/${name}`);
  if (
    request.method !== 'GET' ||
    request.remoteAddress !== input.sourceAddress ||
    request.localAddress !== input.address ||
    !service
  )
    return null;
  return {
    nonce: input.nonce,
    service,
    remoteAddress: request.remoteAddress,
    address: request.localAddress,
  };
}

export async function serveEgressPeer(input) {
  validateEgress(input);
  const server = createServer(
    { maxHeaderSize: 4096, requestTimeout: 3000, headersTimeout: 3000 },
    (req, res) => {
      const receipt = peerResponse(input, {
        method: req.method,
        url: req.url,
        remoteAddress: req.socket.remoteAddress,
        localAddress: req.socket.localAddress,
      });
      res.writeHead(receipt ? 200 : 403, {
        'Content-Type': 'application/json',
        Connection: 'close',
      });
      res.end(JSON.stringify(receipt ?? { denied: true }));
      if (receipt) process.stdout.write(`${JSON.stringify({ event: 'arrival', ...receipt })}\n`);
    },
  );
  server.maxConnections = 4;
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(input.port, input.address, done);
  });
  const stop = () => {
    server.closeAllConnections();
    server.close();
  };
  const sigint = () => stop(),
    sigterm = () => stop();
  // Backstop only; the external VM owner still verifies exact PID/socket cleanup in finally.
  const timer = setTimeout(stop, 15 * 60 * 1000);
  process.once('SIGINT', sigint);
  process.once('SIGTERM', sigterm);
  server.once('close', () => {
    clearTimeout(timer);
    process.removeListener('SIGINT', sigint);
    process.removeListener('SIGTERM', sigterm);
  });
  process.stdout.write(
    `${JSON.stringify({ event: 'ready', address: input.address, port: input.port, nonce: input.nonce })}\n`,
  );
  return server;
}

export function forwardingCounters(rules, subnet, bridge) {
  const count = (rule) => {
    const rows = rules.split('\n').filter((line) => line.endsWith(` ${rule}`));
    assert.equal(rows.length, 1, `Missing/ambiguous forwarding rule: ${rule}`);
    const match = rows[0].match(/^\[(\d+):\d+\] /u);
    assert.ok(match, 'iptables-save -c counters required');
    return Number(match[1]);
  };
  return {
    forward: count('-A FORWARD -j DOCKER-FORWARD'),
    nat: count(`-A POSTROUTING -s ${subnet} ! -o ${bridge} -j MASQUERADE`),
  };
}

export function assertCounterProgress(before, after) {
  for (const name of ['forward', 'nat'])
    assert.ok(after[name] > before[name], `No routed ${name} counter progress`);
}

export async function verifyRoutedEgress({
  input,
  fixture,
  project,
  docker,
  client,
  command,
  record,
}) {
  validateEgress(input, fixture.networks);
  const addresses = JSON.parse(await command('ip', ['-j', 'address']));
  const local = addresses.flatMap((nic) => nic.addr_info.map((item) => item.local));
  assert.ok(local.includes(input.sourceAddress), 'Declared SNAT source is not on daemon host');
  assert.ok(
    !local.includes(input.address),
    'Daemon-host INPUT endpoint cannot prove routed egress',
  );
  for (const service of ['api', 'web']) {
    const networkName = `${project}_ingress-${service}`;
    const network = JSON.parse(await docker(['network', 'inspect', networkName]))[0];
    assert.equal(network.Labels['com.docker.compose.project'], project);
    const bridge =
      network.Options?.['com.docker.network.bridge.name'] ?? `br-${network.Id.slice(0, 12)}`;
    const address = fixture[`${service}Address`];
    const route = JSON.parse(
      await command('ip', ['-j', 'route', 'get', input.address, 'from', address, 'iif', bridge]),
    )[0];
    assert.notEqual(route.type, 'local');
    assert.ok(
      addresses.some(
        (nic) =>
          nic.ifname === route.dev &&
          nic.addr_info.some((item) => item.local === input.sourceAddress),
      ),
      'Forwarded path must leave via the declared peer-facing interface',
    );
    const container = await client(service, 'routes', {});
    const gateway = network.IPAM.Config.find((config) => isIP(config.Gateway) === 4)?.Gateway;
    const hexGateway = Buffer.from(gateway.split('.').map(Number).reverse())
      .toString('hex')
      .toUpperCase();
    assert.ok(
      container.routes.split('\n').some((line) => {
        const columns = line.trim().split(/\s+/u);
        return columns[1] === '00000000' && columns[2] === hexGateway;
      }),
      'App container must route outbound through its own Docker bridge gateway',
    );
    const beforeRules = await command('iptables-save', ['-c']);
    const response = await client(service, 'http', {
      url: `http://${input.address}:${input.port}/${input.nonce}/${service}`,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), {
      nonce: input.nonce,
      service,
      remoteAddress: input.sourceAddress,
      address: input.address,
    });
    const afterRules = await command('iptables-save', ['-c']);
    const before = forwardingCounters(beforeRules, fixture.networks[service], bridge);
    const after = forwardingCounters(afterRules, fixture.networks[service], bridge);
    assertCounterProgress(before, after);
    record(`${service}-routed-synthetic-egress`, {
      route,
      container,
      peer: JSON.parse(response.body),
      before,
      after,
      beforeRules,
      afterRules,
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argument = process.argv.find((arg) => arg.startsWith('--serve='));
  assert.ok(argument, 'Use --serve with explicit synthetic peer JSON');
  await serveEgressPeer(JSON.parse(argument.slice(8)));
}
