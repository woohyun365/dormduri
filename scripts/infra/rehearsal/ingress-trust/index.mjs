#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BlockList, isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveArtifactPath } from '../../../artifacts/paths.mjs';
import { buildIngressComposeArgs, writeIngressConfig } from '../../ingress/render.mjs';
import { assertSourceManifest, sourceManifest } from './source-manifest.mjs';
import { validateEgress, verifyRoutedEgress } from './egress.mjs';

const root = resolve(import.meta.dirname, '../../../..');
export function fixtureInput(mode = 'fixture-http') {
  assert.ok(['fixture-http', 'production-https'].includes(mode), 'Explicit fixture mode required');
  const certificate = {
    certificatePath: '/etc/nginx/ingress-tls/fixture.crt',
    keyPath: '/etc/nginx/ingress-tls/fixture.key',
  };
  return {
    mode,
    apiAuthority: 'api.s1.test',
    webAuthority: 'web.s1.test',
    publicAddress: '172.30.247.2',
    publicIpv6Address: 'fd45:448:247::2',
    privateAddress: '172.30.249.2',
    apiSourceAddress: '172.30.248.2',
    observerAddress: '172.30.250.2',
    apiAddress: '172.30.248.3',
    apiPort: 4000,
    webAddress: '172.30.249.3',
    webPort: 3000,
    webPeers: ['172.30.249.3'],
    nginxPeers: ['172.30.248.2'],
    collectorPeers: ['172.30.250.3'],
    networks: {
      public: '172.30.247.0/28',
      api: '172.30.248.0/28',
      web: '172.30.249.0/28',
      observer: '172.30.250.0/28',
      publicIpv6: 'fd45:448:247::/64',
    },
    ...(mode === 'production-https' ? { tls: { api: certificate, web: certificate } } : {}),
  };
}
export function overlaps(left, right) {
  const [a, prefixA] = left.split('/'),
    [b, prefixB] = right.split('/');
  if (!isIP(a) || isIP(a) !== isIP(b)) return false;
  const type = isIP(a) === 4 ? 'ipv4' : 'ipv6',
    max = type === 'ipv4' ? 32 : 128;
  const one = new BlockList(),
    two = new BlockList();
  one.addSubnet(a, prefixA === undefined ? max : Number(prefixA), type);
  two.addSubnet(b, prefixB === undefined ? max : Number(prefixB), type);
  return one.check(b, type) || two.check(a, type);
}
export function assertNoCollision(input, dockerSubnets, routeOutput) {
  const linuxMaskColumn = /Destination\s+Gateway\s+Genmask/u.test(routeOutput);
  const routes = routeOutput.split(/\r?\n/u).flatMap((line) => {
    const columns = line.trim().split(/\s+/u);
    let [address, prefix] = (columns[0] ?? '').split('/');
    if (/^\d+(?:\.\d+){0,2}$/u.test(address)) {
      const parts = address.split('.');
      prefix ??= String(parts.length * 8);
      address = [...parts, ...Array(4 - parts.length).fill('0')].join('.');
    }
    if (linuxMaskColumn && isIP(address) === 4 && isIP(columns[2] ?? '') === 4) {
      const bits = columns[2]
        .split('.')
        .map((part) => Number(part).toString(2).padStart(8, '0'))
        .join('');
      assert.match(bits, /^1*0*$/u, 'Non-contiguous host route mask');
      prefix = String(bits.indexOf('0') < 0 ? 32 : bits.indexOf('0'));
    }
    if (
      !isIP(address) ||
      address.includes('%') ||
      prefix === '0' ||
      (prefix !== undefined && !/^\d+$/u.test(prefix))
    )
      return [];
    return [`${address}/${prefix ?? (isIP(address) === 4 ? 32 : 128)}`];
  });
  for (const candidate of Object.values(input.networks)) {
    for (const occupied of [...dockerSubnets, ...routes])
      assert.ok(
        !overlaps(candidate, occupied),
        `Fixture subnet collision: ${candidate} / ${occupied}`,
      );
  }
}
export function assertResourceScope(resources, project) {
  assert.match(project, /^dormduri-s1-[a-f0-9]{12}$/u);
  for (const resource of resources)
    assert.equal(
      resource.Config?.Labels?.['com.docker.compose.project'] ??
        resource.Labels?.['com.docker.compose.project'],
      project,
      'Refuse foreign resource cleanup',
    );
}
export async function probeImageSource(project, imageId, docker) {
  assertResourceScope([], project);
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/u);
  const name = `${project}-source-probe`;
  const lookup = () => docker(['ps', '-aq', '--filter', `name=^/${name}$`]);
  // Never claim an existing resource even if its name happens to collide.
  assert.equal(await lookup(), '', 'Source probe name already exists');
  let signal;
  const sigint = () => {
    signal = 'SIGINT';
  };
  const sigterm = () => {
    signal = 'SIGTERM';
  };
  process.once('SIGINT', sigint);
  process.once('SIGTERM', sigterm);
  try {
    const id = await docker([
      'create',
      '--name',
      name,
      '--network',
      'none',
      '--read-only',
      '--user',
      '10001:10001',
      '--label',
      `com.docker.compose.project=${project}`,
      '--entrypoint',
      'cat',
      imageId,
      '/fixture/source-manifest.json',
    ]);
    assert.match(id, /^[a-f0-9]{64}$/u);
    if (signal) throw new Error(`Source probe interrupted: ${signal}`);
    const result = await docker(['start', '-a', id]);
    if (signal) throw new Error(`Source probe interrupted: ${signal}`);
    return JSON.parse(result);
  } finally {
    try {
      // A timed-out create/start CLI may have left its exact named container behind.
      const ids = (await lookup()).split(/\s+/u).filter(Boolean);
      if (ids.length) {
        const resources = JSON.parse(await docker(['inspect', ...ids]));
        assertResourceScope(resources, project);
        for (const resource of resources) assert.equal(resource.Name, `/${name}`);
        await docker(['rm', '-f', ...ids]);
      }
      assert.equal(await lookup(), '', 'Source probe remains after cleanup');
    } finally {
      process.removeListener('SIGINT', sigint);
      process.removeListener('SIGTERM', sigterm);
      if (signal) throw new Error(`Source probe interrupted: ${signal}`);
    }
  }
}

export async function cleanupProject(project, docker, compose) {
  const resources = async (kind) => {
    const args = kind === 'container' ? ['ps', '-aq'] : [kind, 'ls', '-q'];
    return (await docker([...args, '--filter', `label=com.docker.compose.project=${project}`]))
      .split(/\s+/u)
      .filter(Boolean);
  };
  assertResourceScope([], project);
  for (const kind of ['container', 'network', 'volume']) {
    const ids = await resources(kind);
    if (ids.length)
      assertResourceScope(
        JSON.parse(
          await docker(kind === 'container' ? ['inspect', ...ids] : [kind, 'inspect', ...ids]),
        ),
        project,
      );
  }
  await compose(['down', '--volumes', '--remove-orphans', '--timeout', '5']);
  for (const kind of ['container', 'network', 'volume'])
    assert.deepEqual(await resources(kind), [], `Owned ${kind} remains after cleanup`);
}

export async function closeFixture(project, docker, compose, directory) {
  const result = { cleanupConfirmed: false, diagnosticFailure: null, cleanupFailure: null };
  try {
    const logs = await compose(['logs', '--no-color']);
    writeFileSync(resolve(directory, 'services.log'), logs);
  } catch (error) {
    result.diagnosticFailure = String(error);
  }
  try {
    await cleanupProject(project, docker, compose);
    result.cleanupConfirmed = true;
  } catch (error) {
    result.cleanupFailure = String(error);
  }
  return result;
}

export function run(binary, args, env, { timeout = 120000, killGrace = 1000 } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(binary, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '',
      stderr = '';
    let timedOut = false,
      killTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), killGrace);
    }, timeout);
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      !timedOut && code === 0
        ? resolveResult(stdout.trim())
        : reject(
            new Error(
              `${binary} ${args.join(' ')} failed (${timedOut ? 'timeout' : code}): ${stderr.slice(-6000)}`,
            ),
          );
    });
  });
}

export async function runIngressFixture({
  mode = 'fixture-http',
  image,
  egress,
  environment = process.env,
} = {}) {
  assert.match(
    image ?? '',
    /^dormduri-chat-ingress-fixture:[a-zA-Z0-9_.-]+$/u,
    'Use an explicit local fixture image, never a production service image',
  );
  const input = fixtureInput(mode),
    project = `dormduri-s1-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  if (egress !== undefined) validateEgress(egress, input.networks);
  const directory = resolveArtifactPath(root, ['infra', 'ingress-trust', project], environment);
  mkdirSync(directory, { recursive: true });
  const tlsDirectory = resolve(directory, 'tls');
  mkdirSync(tlsDirectory);
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']
      .filter((key) => environment[key])
      .map((key) => [key, environment[key]]),
  );
  const docker = (args, settings) => run('docker', args, env, settings);
  const imageInfo = JSON.parse(await docker(['image', 'inspect', image]))[0];
  assert.equal(imageInfo.Config.Labels?.['dormduri.fixture.kind'], 'chat-ingress-trust');
  assert.match(imageInfo.Id, /^sha256:[a-f0-9]{64}$/u);
  const source = sourceManifest(root);
  const imageSource = await probeImageSource(project, imageInfo.Id, docker);
  assertSourceManifest(source, imageSource);
  writeFileSync(resolve(directory, 'source-manifest.json'), JSON.stringify(source, null, 2));
  const ids = (await docker(['network', 'ls', '-q'])).split(/\s+/u).filter(Boolean);
  const existing = ids.length ? JSON.parse(await docker(['network', 'inspect', ...ids])) : [];
  const routes = await run('netstat', ['-rn'], env);
  assertNoCollision(
    input,
    existing.flatMap((network) =>
      (network.IPAM.Config ?? []).map((item) => item.Subnet).filter(Boolean),
    ),
    routes,
  );
  await run(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=api.s1.test',
      '-addext',
      'subjectAltName=DNS:api.s1.test,DNS:web.s1.test',
      '-keyout',
      resolve(tlsDirectory, 'fixture.key'),
      '-out',
      resolve(tlsDirectory, 'fixture.crt'),
    ],
    env,
  );
  const rendered = writeIngressConfig(input, { repoRoot: root, environment, outputName: project });
  const runtimeEnvFile = resolve(directory, 'fixture.env');
  writeFileSync(runtimeEnvFile, 'NODE_ENV=test\n');
  const proto = mode === 'production-https' ? 'https' : 'http';
  Object.assign(env, rendered.composeEnvironment, {
    API_IMAGE_TAG: 'unused-fixture',
    API_RUNTIME_ENV_FILE: runtimeEnvFile,
    INGRESS_FIXTURE_IMAGE: imageInfo.Id,
    INGRESS_TLS_DIRECTORY: tlsDirectory,
    INGRESS_FIXTURE_ORIGIN: `${proto}://api.s1.test`,
    INGRESS_FIXTURE_WEB_ORIGIN: `${proto}://web.s1.test`,
  });
  const args = (command) =>
    buildIngressComposeArgs(rendered.composeOverridePath, command, {
      repoRoot: root,
      projectName: project,
      fixture: true,
    });
  const compose = (command, settings) => docker(args(command), settings);
  const checks = [];
  const networkFailures = [];
  let created = false,
    complete = false,
    cleanupConfirmed = false,
    signal,
    failure,
    diagnosticFailure,
    cleanupFailure,
    routedEgressVerified = false,
    nginxConfigSha256;
  const interrupted = (value) => {
    signal = value;
  };
  const sigint = () => interrupted('SIGINT'),
    sigterm = () => interrupted('SIGTERM');
  process.once('SIGINT', sigint);
  process.once('SIGTERM', sigterm);
  const record = (name, result) => {
    if (signal) throw new Error(`Fixture interrupted: ${signal}`);
    checks.push({ name, result });
  };
  const client = async (service, action, input) =>
    JSON.parse(
      await compose([
        'exec',
        '-T',
        service,
        'node',
        '/fixture/client.mjs',
        JSON.stringify({ action, ...input }),
      ]),
    );
  const publicUrl = `${proto}://${input.publicAddress}`;
  const http = (service, path, headers = {}, extra = {}) =>
    client(service, 'http', {
      url: `${publicUrl}${path}`,
      headers: { Host: input.apiAuthority, ...headers },
      ...extra,
    });
  const reset = async () => {
    await compose(['restart', 'api']);
    await compose(['up', '-d', '--wait', '--wait-timeout', '60', '--no-build']);
  };
  const ticket = (service, bff = false, spoof = '198.51.100.100') =>
    http(
      service,
      bff ? '/fixture/generic-ticket' : '/api/chat/realtime/tickets',
      {
        Host: bff ? input.webAuthority : input.apiAuthority,
        Authorization: `Bearer fixture-${randomUUID()}`,
        Cookie: `auth-token=fixture-${randomUUID()}`,
        'X-Forwarded-For': spoof,
        'X-Real-IP': spoof,
        Forwarded: `for=${spoof}`,
      },
      { method: 'POST' },
    );
  try {
    const configuration = JSON.parse(await compose(['config', '--format', 'json']));
    writeFileSync(resolve(directory, 'compose.json'), JSON.stringify(configuration, null, 2));
    for (const name of ['api', 'web', 'nginx'])
      assert.equal(configuration.services[name].ports?.length ?? 0, 0);
    assert.deepEqual(Object.keys(configuration.services.api.networks), ['ingress-api']);
    assert.deepEqual(Object.keys(configuration.services.web.networks), ['ingress-web']);
    created = true;
    await compose(['up', '-d', '--wait', '--wait-timeout', '90', '--no-build'], {
      timeout: 150000,
    });
    const nginxConfig = await compose(['exec', '-T', 'nginx', 'nginx', '-T']);
    writeFileSync(resolve(directory, 'nginx-config.txt'), nginxConfig);
    nginxConfigSha256 = createHash('sha256').update(nginxConfig).digest('hex');
    const containerIds = (await compose(['ps', '-aq'])).split(/\s+/u).filter(Boolean);
    const containers = JSON.parse(await docker(['inspect', ...containerIds]));
    assertResourceScope(containers, project);
    record('source-image', {
      id: imageInfo.Id,
      source: imageInfo.Config.Labels['dormduri.fixture.source'],
      mode,
      syntheticCertificate: true,
    });
    record(
      'topology',
      containers.map((container) => ({
        service: container.Config.Labels['com.docker.compose.service'],
        networks: Object.entries(container.NetworkSettings.Networks).map(([name, details]) => ({
          name,
          ip: details.IPAddress,
          ipv6: details.GlobalIPv6Address,
        })),
      })),
    );
    for (const bff of [false, true]) {
      await reset();
      assert.equal((await ticket('client_a', bff)).status, 201);
      assert.equal((await ticket('client_a', bff, '198.51.100.101')).status, 429);
      assert.equal((await ticket('client_b', bff)).status, 201);
      record(bff ? 'bff-ticket-client-separation' : 'direct-ticket-prefix-rotation', 'PASS');
    }
    for (const service of ['client_a', 'client_b']) {
      const result = await http(service, '/fixture/auth-probe', {
        Host: input.webAuthority,
        'X-Forwarded-For': '198.51.100.100',
        'X-Forwarded-Proto': 'ftp',
        'X-Forwarded-Host': 'evil.test',
      });
      assert.equal(result.status, 200);
      const observation = JSON.parse(result.body);
      assert.equal(observation.ip, service === 'client_a' ? '172.30.247.10' : '172.30.247.11');
      assert.equal(observation.peer, input.apiSourceAddress);
      assert.equal(observation.host, input.apiAuthority);
      assert.equal(observation.proto, proto);
      assert.equal(observation.forwarded, undefined);
      record(`auth-bff-${service}`, observation);
    }
    // Actual IPv6 public connection: Nginx observes IPv6, while private transit stays IPv4.
    const ipv6 = await client('client_a', 'http', {
      url: `${proto}://[${input.publicIpv6Address}]/fixture/auth-probe`,
      headers: { Host: input.webAuthority },
    });
    assert.equal(ipv6.status, 200);
    assert.equal(JSON.parse(ipv6.body).ip, 'fd45:448:247::10');
    record('ipv6-edge-preservation', 'PASS');
    for (const transport of ['polling', 'websocket']) {
      for (const bff of [false, true]) {
        await reset();
        let connected = 0;
        for (const service of ['client_a', 'client_b']) {
          const issued = await ticket(service, bff);
          assert.equal(issued.status, 201);
          const connection = {
            url: publicUrl,
            ticket: JSON.parse(issued.body).ticket,
            headers: {
              Host: input.apiAuthority,
              Origin: `${proto}://${input.apiAuthority}`,
              'X-Forwarded-For': '198.51.100.100',
            },
          };
          const first = await client(service, transport, connection);
          assert.ok(first.body.includes('40/chat,'), first.body);
          // Socket.IO's namespace ack alone can precede async ticket/user admission.
          // The real gateway increments this counter only after registering the authenticated user.
          const admitted = await http(service, '/auth/fixture/probe');
          assert.equal(admitted.status, 200);
          assert.equal(JSON.parse(admitted.body).totalConnections, ++connected);
          const denied = await client(service, transport, {
            ...connection,
            headers: { ...connection.headers, 'X-Forwarded-For': '198.51.100.101' },
          });
          assert.equal(denied.status, transport === 'polling' ? 403 : 400);
        }
        record(
          `${transport}-${bff ? 'bff-ticket' : 'direct-ticket'}-prefix-and-distinct-clients`,
          'PASS',
        );
      }
    }
    for (const service of ['client_a', 'collector']) {
      for (const [address, port] of [
        [input.apiAddress, 4000],
        [input.webAddress, 3000],
        [input.privateAddress, 8081],
      ]) {
        const reachable = await client(service, 'tcp', { address, port });
        const name = `${service}-denied-${address}:${port}`;
        record(name, reachable ? 'FAIL: TCP reachable' : 'PASS');
        if (reachable) networkFailures.push(name);
      }
    }
    const privateDenied = await client('untrusted_web', 'http', {
      url: `http://${input.privateAddress}:8081/auth/fixture/probe`,
      headers: { Host: input.apiAuthority },
    });
    assert.equal(privateDenied.status, 403);
    record('non-Web-private-ACL', 'PASS');
    assert.deepEqual(
      await http(
        'client_a',
        '/auth/fixture/probe',
        { Host: 'private.invalid' },
        { expectReset: true, servername: input.apiAuthority },
      ),
      { reset: true },
    );
    record('public-Host-cannot-select-private', 'PASS');
    const observer = `http://${input.observerAddress}:9091`;
    const metrics = await client('collector', 'http', {
      url: `${observer}/internal/metrics`,
      headers: { Authorization: 'Bearer fixture-metrics' },
    });
    assert.equal(metrics.status, 200);
    assert.equal(
      (await client('collector', 'http', { url: `${observer}/internal/metrics` })).status,
      401,
    );
    assert.notEqual(
      (await client('collector', 'http', { url: `${observer}/auth/fixture/probe` })).status,
      200,
    );
    assert.notEqual(
      (await http('client_a', '/internal/metrics', { Host: input.webAuthority })).status,
      200,
    );
    record('observer-metrics-route-and-token', 'PASS');
    if (egress) {
      await verifyRoutedEgress({
        input: egress,
        fixture: input,
        project,
        docker,
        client,
        command: (binary, args) => run(binary, args, env),
        record,
      });
      routedEgressVerified = true;
    }
    // Collect every forbidden path, but never turn an isolation failure into a skip or PASS.
    assert.deepEqual(
      networkFailures,
      [],
      'The selected runner does not enforce the required network isolation',
    );
    complete = true;
    return { directory, project, checks };
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    try {
      if (created) {
        ({ cleanupConfirmed, diagnosticFailure, cleanupFailure } = await closeFixture(
          project,
          docker,
          compose,
          directory,
        ));
        if (cleanupFailure) throw new Error(cleanupFailure);
        if (diagnosticFailure) throw new Error(diagnosticFailure);
        record('exact-project-cleanup', 'PASS');
      }
    } finally {
      writeFileSync(
        resolve(directory, 'result.json'),
        JSON.stringify(
          {
            project,
            mode,
            image: imageInfo.Id,
            checks,
            status:
              complete && cleanupConfirmed && !signal && !diagnosticFailure ? 'passed' : 'failed',
            interrupted: signal ?? null,
            failure:
              failure ??
              cleanupFailure ??
              diagnosticFailure ??
              (signal ? `Fixture interrupted: ${signal}` : null),
            diagnosticFailure: diagnosticFailure ?? null,
            cleanupFailure: cleanupFailure ?? null,
            routedEgressVerified,
            cleanupConfirmed,
            activation: 'NO-GO; synthetic providers/certificate, not actual release evidence',
            sourceSha256: source.sha256,
            nginxConfigSha256: nginxConfigSha256 ?? null,
            renderedComposeSha256: existsSync(resolve(directory, 'compose.json'))
              ? createHash('sha256')
                  .update(readFileSync(resolve(directory, 'compose.json')))
                  .digest('hex')
              : null,
          },
          null,
          2,
        ),
      );
      process.removeListener('SIGINT', sigint);
      process.removeListener('SIGTERM', sigterm);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice(7) ?? 'fixture-http';
  const image = process.argv.find((arg) => arg.startsWith('--image='))?.slice(8);
  const egressArgument = process.argv.find((arg) => arg.startsWith('--egress='))?.slice(9);
  const result = await runIngressFixture({
    mode,
    image,
    ...(egressArgument !== undefined ? { egress: JSON.parse(egressArgument) } : {}),
  });
  console.log(JSON.stringify(result, null, 2));
}
