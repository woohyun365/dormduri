import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { assertSourceManifest, sourceManifest } from './source-manifest.mjs';
import test from 'node:test';
import { expectedReset } from './client.mjs';
import {
  cleanupProject,
  probeImageSource,
  assertNoCollision,
  assertResourceScope,
  fixtureInput,
  overlaps,
  run,
} from './index.mjs';

test('fixture is explicit, dual stack and account-free; invalid mode fails closed', () => {
  assert.equal(fixtureInput().mode, 'fixture-http');
  assert.equal(
    fixtureInput('production-https').tls.api.certificatePath,
    '/etc/nginx/ingress-tls/fixture.crt',
  );
  assert.throws(() => fixtureInput('production'), /mode/u);
});
test('collision check covers Docker, abbreviated macOS IPv4 and Linux netmasks', () => {
  const input = fixtureInput();
  for (const [subnets, routes] of [
    [['172.30.247.0/28'], ''],
    [[], '172.30/16 1.2.3.4 UG'],
    [[], '172.30 1.2.3.4 UG'],
    [[], 'Destination Gateway Genmask\n172.30.0.0 0.0.0.0 255.255.0.0'],
    [[], 'fd45:448:247::/64 fe80::1 UG'],
  ])
    assert.throws(() => assertNoCollision(input, subnets, routes), /collision/u);
  assert.doesNotThrow(() =>
    assertNoCollision(input, ['172.17.0.0/16'], 'default 1.2.3.4\n::/0 fe80::1\n127.0.0.1 lo0'),
  );
  assert.equal(overlaps('fd45:448:247::/64', 'fd45:448:248::/64'), false);
  assert.equal(overlaps('172.30.248.0/28', '172.30.248.2/32'), true);
});
test('cleanup refuses mismatched container/network labels and unsafe project names', () => {
  const project = 'knu-s1-012345abcdef';
  assert.doesNotThrow(() =>
    assertResourceScope(
      [
        { Config: { Labels: { 'com.docker.compose.project': project } } },
        { Labels: { 'com.docker.compose.project': project } },
      ],
      project,
    ),
  );
  assert.throws(() =>
    assertResourceScope([{ Labels: { 'com.docker.compose.project': 'user-project' } }], project),
  );
  assert.throws(() => assertResourceScope([], 'knu-roommate'));
});
test('harness contains exact-project cleanup on failure and never broad prune or production bootstrap', () => {
  const source = readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');
  assert.match(source, /finally\s*\{/u);
  assert.match(source, /assertResourceScope/u);
  assert.match(source, /down.*--volumes/u);
  assert.doesNotMatch(source, /system.*prune|network.*prune|docker.*login/u);
  const api = readFileSync(new URL('./api.fixture.mjs', import.meta.url), 'utf8');
  assert.match(api, /ChatController/u);
  assert.match(api, /ChatRealtimeIoAdapter/u);
  assert.doesNotMatch(api, /AppModule|dist\/main/u);
  const web = readFileSync(new URL('./web.fixture.mjs', import.meta.url), 'utf8');
  assert.match(web, /forwardBffRequest/u);
  assert.match(web, /forwardAuthRequest/u);
});

test('fixture commands propagate failure and bound a child that ignores SIGTERM', async () => {
  assert.equal(await run(process.execPath, ['-e', 'process.stdout.write("ok")'], {}), 'ok');
  await assert.rejects(run(process.execPath, ['-e', 'process.exit(2)'], {}), /failed \(2\)/u);
  const start = Date.now();
  await assert.rejects(
    run(
      process.execPath,
      ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],
      {},
      { timeout: 200, killGrace: 50 },
    ),
    /timeout/u,
  );
  assert.ok(Date.now() - start < 3000, 'An unresponsive owned subprocess must be killed');
});

test('only explicit Nginx close denial accepts ECONNRESET, never TLS or other errors', () => {
  assert.equal(expectedReset({ expectReset: true }, { code: 'ECONNRESET' }), true);
  assert.equal(expectedReset({}, { code: 'ECONNRESET' }), false);
  for (const code of ['ERR_TLS_CERT_ALTNAME_INVALID', 'ECONNREFUSED', 'ETIMEDOUT'])
    assert.equal(expectedReset({ expectReset: true }, { code }), false);
});

test('image attribution rejects missing/stale/manipulated source snapshots and ignores generated outputs', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-ingress-source-'));
  const fixture = resolve(root, 'scripts/infra/rehearsal/ingress-trust');
  try {
    for (const dir of [
      'apps/api/src',
      'apps/web/src',
      'packages/shared/src',
      'scripts/infra/rehearsal/ingress-trust',
    ])
      mkdirSync(resolve(root, dir), { recursive: true });
    for (const name of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'apps/api/src/example.ts',
      'apps/web/src/example.ts',
      'packages/shared/src/example.ts',
      'scripts/infra/rehearsal/ingress-trust/client.mjs',
    ])
      writeFileSync(resolve(root, name), 'baseline');
    const original = sourceManifest(root);
    assert.doesNotThrow(() => assertSourceManifest(original, sourceManifest(root)));
    assert.throws(() => assertSourceManifest(original, null), /Missing/u);
    assert.throws(
      () => assertSourceManifest(original, { ...original, sha256: 'wrong' }),
      /mismatched/u,
    );
    mkdirSync(resolve(root, 'apps/web/.next'));
    writeFileSync(resolve(root, 'apps/web/.next/output'), 'generated');
    assert.doesNotThrow(() => assertSourceManifest(original, sourceManifest(root)));
    for (const name of [
      'apps/api/src/example.ts',
      'apps/web/src/example.ts',
      'packages/shared/src/example.ts',
      'scripts/infra/rehearsal/ingress-trust/client.mjs',
      'pnpm-lock.yaml',
    ]) {
      writeFileSync(resolve(root, name), 'changed');
      assert.throws(() => assertSourceManifest(original, sourceManifest(root, fixture)), /Stale/u);
      writeFileSync(resolve(root, name), 'baseline');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function withSourceRoot(check) {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-ingress-source-'));
  try {
    for (const name of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'apps/api/src/example.ts',
      'apps/web/src/example.ts',
      'packages/shared/src/example.ts',
      'scripts/infra/rehearsal/ingress-trust/client.mjs',
    ]) {
      mkdirSync(dirname(resolve(root, name)), { recursive: true });
      writeFileSync(resolve(root, name), 'baseline');
    }
    check(root, sourceManifest(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
// Adds a file, or a directory holding one, at `path`; the image build context never receives either.
function assertDropped(root, original, path, message) {
  for (const target of [path, `${path}/child`]) {
    mkdirSync(dirname(resolve(root, target)), { recursive: true });
    writeFileSync(resolve(root, target), 'local');
    assert.doesNotThrow(() => assertSourceManifest(original, sourceManifest(root)), message);
    rmSync(resolve(root, path), { recursive: true, force: true });
  }
}

test('image attribution drops local auth state and stress temp files but keeps their siblings', () => {
  withSourceRoot((root, original) => {
    for (const path of [
      'apps/web/playwright/.auth',
      'apps/api/test/stress/fixtures/.tmp-run',
      'apps/api/test/stress/reports/.tmp-run',
    ])
      assertDropped(root, original, path, path);
    for (const path of [
      'apps/web/playwright/keep.spec.ts',
      'apps/api/test/stress/fixtures/keep.json',
      'apps/web/src/.auth',
      'apps/api/src/.tmp-run',
    ]) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), 'source');
      assert.throws(() => assertSourceManifest(original, sourceManifest(root)), /Stale/u, path);
      rmSync(resolve(root, path), { force: true });
    }
  });
});

test('source manifest drops every .dockerignore exclusion under the fixture COPY roots', () => {
  const lines = readFileSync(new URL('../../../../.dockerignore', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
  const checked = { anyDepth: 0, scoped: 0 };
  withSourceRoot((root, original) => {
    for (const line of lines) {
      const pattern = line.replace(/\/$/u, '');
      let path;
      if (pattern.startsWith('**/')) {
        path = `apps/web/src/${pattern.slice(3)}`;
        checked.anyDepth++;
      } else if (/^(?:apps\/(?:api|web)|packages)\//u.test(pattern)) {
        path = pattern;
        checked.scoped++;
      } else continue;
      assert.match(
        path,
        /^[\w.*/-]+$/u,
        `Unsupported .dockerignore syntax for this check: ${line}`,
      );
      assert.doesNotMatch(path, /\*\*/u, `Nested ** in ${line}`);
      assertDropped(root, original, path.replaceAll('*', 'x'), line);
    }
  });
  assert.ok(checked.anyDepth > 0 && checked.scoped > 0, JSON.stringify(checked));
});

function cleanupDouble({ foreign = false, failDown = false, leftover = false } = {}) {
  const project = 'knu-s1-012345abcdef';
  const resources = { container: ['c'], network: ['n'], volume: ['v'] };
  const commands = [];
  const docker = async (args) => {
    commands.push(args);
    const kind = ['ps', 'inspect'].includes(args[0]) ? 'container' : args[0];
    if (args.includes('inspect'))
      return JSON.stringify([
        {
          Labels: {
            'com.docker.compose.project': foreign && kind === 'volume' ? 'someone-else' : project,
          },
        },
      ]);
    assert.ok(args.includes(`label=com.docker.compose.project=${project}`));
    return resources[kind].join('\n');
  };
  const compose = async (args) => {
    commands.push(args);
    assert.deepEqual(args, ['down', '--volumes', '--remove-orphans', '--timeout', '5']);
    if (failDown) throw new Error('injected Docker failure');
    resources.container = [];
    resources.network = [];
    resources.volume = leftover ? ['v'] : [];
  };
  return { project, docker, compose, commands };
}
test('exact cleanup handles empty/repeated cleanup and verifies containers, networks and volumes', async () => {
  const fixture = cleanupDouble();
  await cleanupProject(fixture.project, fixture.docker, fixture.compose);
  await cleanupProject(fixture.project, fixture.docker, fixture.compose);
  assert.ok(fixture.commands.some((args) => args[0] === 'volume' && args[1] === 'inspect'));
});
test('cleanup fails closed before foreign mutation and on command failure or leftover owned volume', async () => {
  const foreign = cleanupDouble({ foreign: true });
  await assert.rejects(
    cleanupProject(foreign.project, foreign.docker, foreign.compose),
    /foreign/u,
  );
  assert.ok(!foreign.commands.some((args) => args[0] === 'down'));
  for (const options of [{ failDown: true }, { leftover: true }]) {
    const fixture = cleanupDouble(options);
    await assert.rejects(
      cleanupProject(fixture.project, fixture.docker, fixture.compose),
      /injected|remains/u,
    );
  }
});

test('manifest probe owns create/start timeout and signal cleanup before the main lifecycle', async () => {
  const project = 'knu-s1-012345abcdef',
    image = `sha256:${'a'.repeat(64)}`,
    id = 'b'.repeat(64);
  for (const failure of [null, 'create', 'start', 'SIGINT', 'SIGTERM', 'cleanup-SIGTERM']) {
    let exists = false;
    const calls = [];
    const docker = async (args) => {
      calls.push(args);
      if (args[0] === 'ps') {
        assert.equal(args.at(-1), `name=^/${project}-source-probe$`);
        return exists ? id : '';
      }
      if (args[0] === 'create') {
        exists = true;
        if (failure === 'create') throw new Error('timeout');
        return id;
      }
      if (args[0] === 'start') {
        assert.equal(args[2], id);
        if (failure === 'start') throw new Error('timeout');
        if (failure?.startsWith('SIG')) process.emit(failure);
        return '{}';
      }
      if (args[0] === 'inspect')
        return JSON.stringify([
          {
            Name: `/${project}-source-probe`,
            Config: { Labels: { 'com.docker.compose.project': project } },
          },
        ]);
      assert.deepEqual(args, ['rm', '-f', id]);
      exists = false;
      if (failure === 'cleanup-SIGTERM') process.emit('SIGTERM');
      return id;
    };
    if (failure)
      await assert.rejects(probeImageSource(project, image, docker), /timeout|interrupted/u);
    else assert.deepEqual(await probeImageSource(project, image, docker), {});
    assert.equal(exists, false);
    assert.ok(calls.some((args) => args[0] === 'rm'));
  }
});

test('fixture closeout records diagnostic and cleanup failures without skipping cleanup', async () => {
  const { closeFixture } = await import('./index.mjs');
  for (const failLogs of [false, true]) {
    for (const failDown of [false, true]) {
      const fixture = cleanupDouble({ failDown });
      const directory = mkdtempSync(resolve(tmpdir(), 'knu-ingress-closeout-'));
      try {
        const result = await closeFixture(
          fixture.project,
          fixture.docker,
          async (args) => {
            if (args[0] === 'logs') {
              if (failLogs) throw new Error('injected logs failure');
              return 'fixture logs';
            }
            return fixture.compose(args);
          },
          directory,
        );
        assert.equal(result.cleanupConfirmed, !failDown);
        assert.equal(Boolean(result.diagnosticFailure), failLogs);
        assert.equal(Boolean(result.cleanupFailure), failDown);
        assert.ok(fixture.commands.some((args) => args[0] === 'down'));
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }
});

test('routed egress config rejects unbounded, public, same-host and fixture-network endpoints', async () => {
  const { validateEgress } = await import('./egress.mjs');
  const valid = {
    address: '172.31.254.2',
    sourceAddress: '172.31.254.1',
    port: 18080,
    nonce: 'a'.repeat(32),
  };
  assert.deepEqual(validateEgress(valid, fixtureInput().networks), valid);
  for (const change of [
    { address: 'example.test' },
    { address: '8.8.8.8' },
    { address: '127.0.0.1' },
    { address: '172.31.254.1' },
    { address: '172.30.248.3' },
    { sourceAddress: '172.30.249.3' },
    { port: 80 },
    { port: 65536 },
    { port: '18080' },
    { nonce: '' },
  ])
    assert.throws(() => validateEgress({ ...valid, ...change }, fixtureInput().networks));
});

test('synthetic peer admits only declared source, nonce and api/web GET path', async () => {
  const { peerResponse } = await import('./egress.mjs');
  const input = {
    address: '172.31.254.2',
    sourceAddress: '172.31.254.1',
    port: 18080,
    nonce: 'a'.repeat(32),
  };
  const request = {
    remoteAddress: input.sourceAddress,
    localAddress: input.address,
    method: 'GET',
    url: `/${input.nonce}/api`,
  };
  assert.deepEqual(peerResponse(input, request), {
    nonce: input.nonce,
    service: 'api',
    remoteAddress: input.sourceAddress,
    address: input.address,
  });
  for (const change of [
    { remoteAddress: '172.31.254.3' },
    { localAddress: '172.31.254.3' },
    { method: 'POST' },
    { url: '/wrong/api' },
    { url: `/${input.nonce}/db` },
  ])
    assert.equal(peerResponse(input, { ...request, ...change }), null);
});

test('routed evidence requires matching NAT and FORWARD counter progress', async () => {
  const { forwardingCounters, assertCounterProgress } = await import('./egress.mjs');
  const rules = (n) =>
    `*filter\n[${n}:100] -A FORWARD -j DOCKER-FORWARD\nCOMMIT\n*nat\n[${n}:100] -A POSTROUTING -s 172.30.248.0/28 ! -o br-test -j MASQUERADE\nCOMMIT\n`;
  const before = forwardingCounters(rules(2), '172.30.248.0/28', 'br-test');
  const after = forwardingCounters(rules(3), '172.30.248.0/28', 'br-test');
  assert.doesNotThrow(() => assertCounterProgress(before, after));
  assert.throws(() => assertCounterProgress(before, before));
  assert.throws(() => forwardingCounters(rules(3), '172.30.249.0/28', 'br-test'));
});

test('egress probes both real app containers and rejects INPUT-only, stale nonce and missing NAT', async () => {
  const { verifyRoutedEgress } = await import('./egress.mjs');
  const input = {
    address: '172.31.254.2',
    sourceAddress: '172.31.254.1',
    port: 18080,
    nonce: 'a'.repeat(32),
  };
  const fixture = fixtureInput(),
    project = 'knu-s1-012345abcdef';
  for (const fault of [null, 'local', 'nonce', 'nat']) {
    const calls = [],
      records = [];
    let packets = 1;
    const rules = () =>
      `*filter\n[${packets}:100] -A FORWARD -j DOCKER-FORWARD\nCOMMIT\n*nat\n` +
      ['api', 'web']
        .map(
          (name) =>
            `[${fault === 'nat' ? 1 : packets}:100] -A POSTROUTING -s ${fixture.networks[name]} ! -o br-${name} -j MASQUERADE`,
        )
        .join('\n') +
      '\nCOMMIT\n';
    const command = async (binary, args) => {
      if (binary === 'iptables-save') return rules();
      if (args.includes('address'))
        return JSON.stringify([
          {
            ifname: 'enp0s2',
            addr_info: [
              { local: input.sourceAddress },
              ...(fault === 'local' ? [{ local: input.address }] : []),
            ],
          },
        ]);
      assert.ok(args.includes('iif'));
      return JSON.stringify([{ dev: 'enp0s2', dst: input.address }]);
    };
    const docker = async (args) => {
      const name = args.at(-1).endsWith('api') ? 'api' : 'web';
      return JSON.stringify([
        {
          Labels: { 'com.docker.compose.project': project },
          Options: { 'com.docker.network.bridge.name': `br-${name}` },
          IPAM: { Config: [{ Gateway: name === 'api' ? '172.30.248.1' : '172.30.249.1' }] },
        },
      ]);
    };
    const client = async (service, action) => {
      calls.push([service, action]);
      if (action === 'routes')
        return { routes: `eth0 00000000 ${service === 'api' ? '01F81EAC' : '01F91EAC'} 0003` };
      packets++;
      return {
        status: 200,
        body: JSON.stringify({
          nonce: fault === 'nonce' ? 'wrong' : input.nonce,
          service,
          remoteAddress: input.sourceAddress,
          address: input.address,
        }),
      };
    };
    const promise = verifyRoutedEgress({
      input,
      fixture,
      project,
      docker,
      client,
      command,
      record: (...args) => records.push(args),
    });
    if (fault) await assert.rejects(promise);
    else {
      await promise;
      assert.deepEqual(calls, [
        ['api', 'routes'],
        ['api', 'http'],
        ['web', 'routes'],
        ['web', 'http'],
      ]);
      assert.equal(records.length, 2);
    }
  }
});
