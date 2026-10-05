#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isIP, SocketAddress } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { buildComposeArgs, loadComposeInventory } from '../compose/profile.mjs';

const defaultRepoRoot = resolve(import.meta.dirname, '../../..');
const profileFiles = [
  'infra/deploy/compose.api.yml',
  'infra/rehearsal/compose.web.yml',
  'infra/deploy/compose.ingress-trust.yml',
];
const fixtureFile = 'infra/rehearsal/compose.ingress-trust.fixture.yml';
const networkNames = ['public', 'api', 'web', 'observer'];
const inputKeys = [
  'mode',
  'apiAuthority',
  'webAuthority',
  'publicAddress',
  'publicIpv6Address',
  'privateAddress',
  'apiSourceAddress',
  'observerAddress',
  'apiAddress',
  'apiPort',
  'webAddress',
  'webPort',
  'webPeers',
  'nginxPeers',
  'collectorPeers',
  'networks',
  'tls',
];

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid ingress trust input: ${message}`);
}

function record(value, allowedKeys, label) {
  invariant(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object`,
  );
  invariant(
    Object.keys(value).every((key) => allowedKeys.includes(key)),
    `${label} has an unknown field`,
  );
}

function ip(value, family, label) {
  invariant(
    typeof value === 'string' && !value.includes('%') && isIP(value) === family,
    `${label} must be an IPv${family} literal`,
  );
  const canonical = new SocketAddress({ address: value, family: family === 4 ? 'ipv4' : 'ipv6' })
    .address;
  invariant(canonical === value, `${label} must be canonical`);
  invariant(!['0.0.0.0', '::', '::1'].includes(value), `${label} must not be a wildcard/loopback`);
  invariant(
    family === 6
      ? !/^(?:ff|fe[89ab]|::ffff:)/u.test(value)
      : Number(value.split('.')[0]) > 0 &&
          Number(value.split('.')[0]) < 224 &&
          !value.startsWith('127.'),
    `${label} must be unicast`,
  );
  return value;
}

function ipNumber(value) {
  if (isIP(value) === 4)
    return value.split('.').reduce((result, part) => result * 256n + BigInt(part), 0n);
  let normalized = value;
  if (value.includes('.')) {
    const index = value.lastIndexOf(':');
    const tail = ipNumber(value.slice(index + 1));
    normalized = `${value.slice(0, index)}:${(tail >> 16n).toString(16)}:${(tail & 65535n).toString(16)}`;
  }
  const [left, right] = normalized.split('::');
  const first = left ? left.split(':') : [];
  const last = right ? right.split(':') : [];
  const parts = normalized.includes('::')
    ? [...first, ...Array(8 - first.length - last.length).fill('0'), ...last]
    : first;
  return parts.reduce((result, part) => result * 65536n + BigInt(`0x${part}`), 0n);
}

function subnet(value, family, label) {
  invariant(typeof value === 'string', `${label} must be a CIDR`);
  const [address, prefixText, extra] = value.split('/');
  invariant(
    extra === undefined && /^(?:0|[1-9]\d*)$/u.test(prefixText ?? ''),
    `${label} must be a CIDR`,
  );
  invariant(
    isIP(address) === family && !address.includes('%'),
    `${label} has invalid address family`,
  );
  const prefix = Number(prefixText);
  const bits = family === 4 ? 32 : 128;
  invariant(prefix > 0 && prefix <= bits - 2, `${label} must leave room for explicit peers`);
  const size = 1n << BigInt(bits - prefix);
  const start = ipNumber(address);
  invariant(start % size === 0n, `${label} must use the network address`);
  invariant(
    new SocketAddress({ address, family: family === 4 ? 'ipv4' : 'ipv6' }).address === address,
    `${label} must be canonical`,
  );
  return { start, end: start + size - 1n, value, family };
}

function member(address, network, label) {
  const value = ipNumber(ip(address, network.family, label));
  invariant(
    value > network.start + 1n && value < network.end,
    `${label} must be a non-gateway host in its network`,
  );
}

function authority(value, port, label) {
  invariant(typeof value === 'string' && value.length <= 253, `${label} must be a DNS authority`);
  const [host, portText, extra] = value.split(':');
  invariant(
    extra === undefined && (portText === undefined || portText === String(port)),
    `${label} port must match the public listener`,
  );
  invariant(
    host.includes('.') &&
      host.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(part)),
    `${label} must be a canonical DNS authority`,
  );
  return host;
}

function certificate(value, label) {
  record(value, ['certificatePath', 'keyPath'], label);
  for (const name of ['certificatePath', 'keyPath']) {
    invariant(
      typeof value[name] === 'string' &&
        /^\/etc\/nginx\/ingress-tls\/[a-zA-Z0-9_./-]+$/u.test(value[name]) &&
        !value[name].split('/').includes('..') &&
        resolve(value[name]) === value[name],
      `${label}.${name} must stay in the read-only certificate mount`,
    );
  }
  return `ssl_certificate ${value.certificatePath};\n  ssl_certificate_key ${value.keyPath};\n  ssl_protocols TLSv1.2 TLSv1.3;\n  http2 on;`;
}

function validate(input) {
  record(input, inputKeys, 'input');
  invariant(
    ['fixture-http', 'production-https'].includes(input.mode),
    'mode must explicitly select fixture HTTP or production HTTPS',
  );
  const https = input.mode === 'production-https';
  const publicPort = https ? 443 : 80;
  const apiHost = authority(input.apiAuthority, publicPort, 'apiAuthority');
  const webHost = authority(input.webAuthority, publicPort, 'webAuthority');
  invariant(apiHost !== webHost, 'API and Web hosts must differ');
  record(input.networks, [...networkNames, 'publicIpv6'], 'networks');
  const networks = Object.fromEntries(
    networkNames.map((name) => [name, subnet(input.networks[name], 4, `networks.${name}`)]),
  );
  for (const [index, name] of networkNames.entries()) {
    for (const other of networkNames.slice(index + 1)) {
      invariant(
        networks[name].end < networks[other].start || networks[other].end < networks[name].start,
        'networks overlap',
      );
    }
  }
  for (const [key, network] of Object.entries({
    publicAddress: 'public',
    privateAddress: 'web',
    apiSourceAddress: 'api',
    observerAddress: 'observer',
    apiAddress: 'api',
    webAddress: 'web',
  })) {
    member(input[key], networks[network], key);
  }
  invariant(
    input.apiAddress !== input.apiSourceAddress && input.webAddress !== input.privateAddress,
    'application and ingress addresses overlap',
  );
  for (const [key, expected] of [
    ['webPeers', input.webAddress],
    ['nginxPeers', input.apiSourceAddress],
  ]) {
    invariant(
      Array.isArray(input[key]) && input[key].length === 1 && input[key][0] === expected,
      `${key} must contain only the configured service peer`,
    );
  }
  invariant(
    Array.isArray(input.collectorPeers) &&
      input.collectorPeers.length > 0 &&
      input.collectorPeers.length <= 16,
    'collectorPeers must be a bounded nonempty array',
  );
  invariant(
    new Set(input.collectorPeers).size === input.collectorPeers.length,
    'duplicate collector peer',
  );
  for (const peer of input.collectorPeers) {
    member(peer, networks.observer, 'collector peer');
    invariant(peer !== input.observerAddress, 'collector and ingress addresses overlap');
  }
  for (const key of ['apiPort', 'webPort'])
    invariant(
      Number.isInteger(input[key]) && input[key] > 0 && input[key] <= 65535,
      `${key} must be an integer port`,
    );
  const ipv6 = input.publicIpv6Address !== undefined || input.networks.publicIpv6 !== undefined;
  if (ipv6)
    member(
      input.publicIpv6Address,
      subnet(input.networks.publicIpv6, 6, 'networks.publicIpv6'),
      'publicIpv6Address',
    );
  let apiTls = '';
  let webTls = '';
  if (https) {
    record(input.tls, ['api', 'web'], 'tls');
    apiTls = certificate(input.tls.api, 'tls.api');
    webTls = certificate(input.tls.web, 'tls.web');
  } else invariant(input.tls === undefined, 'fixture HTTP cannot carry TLS settings');
  return { https, publicPort, apiHost, webHost, apiTls, webTls, ipv6 };
}

export function validateIngressTrustProfile(profile) {
  invariant(
    profile && JSON.stringify(profile.files) === JSON.stringify(profileFiles),
    'ingress-trust profile must use the exact API/Web/target file order',
  );
  invariant(
    !profile.managedNetworks?.length && !profile.envFile,
    'ingress-trust must not reuse legacy external networks or env files',
  );
}

export function buildIngressComposeArgs(
  composeOverridePath,
  composeArgs = ['config'],
  { repoRoot = defaultRepoRoot, projectName, fixture = false } = {},
) {
  invariant(
    typeof composeOverridePath === 'string' &&
      composeOverridePath.endsWith('/compose.networks.yml'),
    'generated network overlay is required',
  );
  invariant(typeof fixture === 'boolean', 'fixture must be explicit');
  invariant(
    Array.isArray(composeArgs) &&
      composeArgs.every((arg) => typeof arg === 'string' && !/^(?:-f|--file(?:=|$))/u.test(arg)),
    'arbitrary Compose overlays are forbidden',
  );
  const inventory = loadComposeInventory(repoRoot);
  validateIngressTrustProfile(inventory.profiles['ingress-trust']);
  return [
    ...buildComposeArgs(inventory, 'ingress-trust', [], { repoRoot, projectName }),
    '-f',
    resolve(composeOverridePath),
    ...(fixture ? ['-f', fixtureFile] : []),
    ...composeArgs,
  ];
}

function proxyHeaders({ authority: host, source, identity, scheme }) {
  return `proxy_http_version 1.1;\n    proxy_bind ${source};\n    proxy_set_header Host ${host};\n    proxy_set_header X-Forwarded-For ${identity};\n    proxy_set_header X-Real-IP "";\n    proxy_set_header Forwarded "";\n    proxy_set_header X-Forwarded-Host ${host};\n    proxy_set_header X-Forwarded-Proto ${scheme};\n    proxy_set_header X-Request-Id $request_id_or_fallback;\n    proxy_connect_timeout 5s;\n    proxy_send_timeout 60s;\n    proxy_read_timeout 60s;\n    proxy_buffering off;`;
}

export function renderIngressConfig(input, { repoRoot = defaultRepoRoot } = {}) {
  const settings = validate(input);
  const scheme = settings.https ? 'https' : 'http';
  const listeners = (defaultServer = false) =>
    [input.publicAddress, ...(settings.ipv6 ? [`[${input.publicIpv6Address}]`] : [])]
      .map(
        (address) =>
          `listen ${address}:${settings.publicPort}${settings.https ? ' ssl' : ''}${defaultServer ? ' default_server' : ''};`,
      )
      .join('\n  ');
  const headers = (host, source, identity) =>
    proxyHeaders({ authority: host, source, identity, scheme });
  const values = {
    PUBLIC_LISTEN: listeners(),
    DEFAULT_LISTEN: listeners(true),
    API_TLS: settings.apiTls,
    WEB_TLS: settings.webTls,
    API_HOST: settings.apiHost,
    WEB_HOST: settings.webHost,
    API_HOST_PATTERN: `${settings.apiHost.replaceAll('.', '\\.')}(?::${settings.publicPort})?`,
    WEB_HOST_PATTERN: `${settings.webHost.replaceAll('.', '\\.')}(?::${settings.publicPort})?`,
    API_UPSTREAM: `${input.apiAddress}:${input.apiPort}`,
    WEB_UPSTREAM: `${input.webAddress}:${input.webPort}`,
    PRIVATE_ADDRESS: input.privateAddress,
    OBSERVER_ADDRESS: input.observerAddress,
    PUBLIC_API_HEADERS: headers(input.apiAuthority, input.apiSourceAddress, '$remote_addr'),
    PUBLIC_WEB_HEADERS: headers(input.webAuthority, input.privateAddress, '$remote_addr'),
    PRIVATE_HEADERS: headers(input.apiAuthority, input.apiSourceAddress, '$http_x_forwarded_for'),
    OBSERVER_HEADERS: headers(input.apiAuthority, input.apiSourceAddress, '""'),
    WEB_ACL: `${input.webPeers.map((peer) => `allow ${peer};`).join('\n    ')}\n    deny all;`,
    COLLECTOR_ACL: `${input.collectorPeers.map((peer) => `allow ${peer};`).join('\n    ')}\n    deny all;`,
  };
  const files = Object.fromEntries(
    ['public-api', 'public-web', 'private-bff', 'internal-metrics'].map((name) => {
      const template = readFileSync(
        resolve(repoRoot, `infra/deploy/nginx/templates/${name}.conf.template`),
        'utf8',
      );
      const rendered = template.replace(/__([A-Z_]+)__/gu, (_token, key) => {
        invariant(Object.hasOwn(values, key), `unresolved template key ${key}`);
        return values[key];
      });
      invariant(!/__\w+__/u.test(rendered), 'unresolved template token');
      return [`${name}.conf`, rendered];
    }),
  );
  const composeNetworks = Object.fromEntries(
    networkNames.map((name) => [
      `ingress-${name}`,
      {
        driver: 'bridge',
        ...(name === 'public' ? { enable_ipv6: settings.ipv6 } : {}),
        ipam: {
          config: [
            { subnet: input.networks[name] },
            ...(name === 'public' && settings.ipv6 ? [{ subnet: input.networks.publicIpv6 }] : []),
          ],
        },
      },
    ]),
  );
  const networkOverlay = {
    networks: composeNetworks,
    ...(settings.ipv6
      ? {
          services: {
            nginx: { networks: { 'ingress-public': { ipv6_address: input.publicIpv6Address } } },
          },
        }
      : {}),
  };
  const composeEnvironment = {
    INGRESS_PUBLIC_PORT: String(settings.publicPort),
    INGRESS_PUBLIC_ADDRESS: input.publicAddress,
    INGRESS_PRIVATE_ADDRESS: input.privateAddress,
    INGRESS_API_SOURCE_ADDRESS: input.apiSourceAddress,
    INGRESS_OBSERVER_ADDRESS: input.observerAddress,
    INGRESS_API_ADDRESS: input.apiAddress,
    INGRESS_API_PORT: String(input.apiPort),
    INGRESS_WEB_ADDRESS: input.webAddress,
    INGRESS_WEB_PORT: String(input.webPort),
    INGRESS_WEB_APP_URL: `${scheme}://${input.webAuthority}`,
    INGRESS_API_URL: `http://${input.privateAddress}:8081`,
    INGRESS_HTTP_TRUST_PROXY_CIDRS: `${input.apiSourceAddress}/32`,
  };
  return { files, networkOverlay, composeEnvironment };
}

export function writeIngressConfig(
  input,
  { repoRoot = defaultRepoRoot, environment = process.env, outputName = 'rendered' } = {},
) {
  invariant(
    typeof outputName === 'string' && /^[a-zA-Z0-9_-]+$/u.test(outputName),
    'outputName must be a single artifact name',
  );
  const rendered = renderIngressConfig(input, { repoRoot });
  const outputRoot = resolveArtifactPath(
    repoRoot,
    ['infra', 'ingress-trust', outputName],
    environment,
  );
  const directory = resolve(outputRoot, 'conf.d');
  mkdirSync(directory, { recursive: true });
  for (const [name, contents] of Object.entries(rendered.files))
    writeFileSync(resolve(directory, name), contents);
  const composeOverridePath = resolve(outputRoot, 'compose.networks.yml');
  // JSON is valid YAML; no optional empty IPAM entry or text interpolation is emitted.
  writeFileSync(composeOverridePath, `${JSON.stringify(rendered.networkOverlay, null, 2)}\n`);
  const composeEnvironment = {
    ...rendered.composeEnvironment,
    INGRESS_CONFIG_DIRECTORY: directory,
  };
  if (input.mode === 'fixture-http') {
    const emptyTls = resolve(outputRoot, 'empty-tls');
    mkdirSync(emptyTls, { recursive: true });
    composeEnvironment.INGRESS_TLS_DIRECTORY = emptyTls;
  }
  return { ...rendered, directory, composeOverridePath, composeEnvironment };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [inputPath, outputName] = process.argv.slice(2);
  invariant(inputPath, 'usage: node scripts/infra/ingress/render.mjs <input.json> [output-name]');
  const result = writeIngressConfig(JSON.parse(readFileSync(resolve(inputPath), 'utf8')), {
    outputName,
  });
  console.log(
    JSON.stringify(
      {
        directory: result.directory,
        composeOverridePath: result.composeOverridePath,
        composeEnvironment: result.composeEnvironment,
      },
      null,
      2,
    ),
  );
}
