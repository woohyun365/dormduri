// 백오피스 host compose(infra/deploy/backoffice/compose.yml)의 구조 계약(backoffice-foundation D-BF2·D-BF13·D-BF15).
// `docker compose --profile bootstrap config --format json` 결과를 받아 어긋난 점의 목록을 돌려준다(빈 목록 = 통과).
// validate-compose가 실제 파일에, test가 fixture에 쓴다.
// 기준: host publish는 admin ingress의 `127.0.0.1:4300 → 8080` 한 줄뿐(다른 service·다른 주소·IPv6·여러 줄은 실패, Lightsail
// 방화벽은 같은 계정 사설 IP traffic을 막지 않는다). read-only root·tmpfs·capability 모두 제거·no-new-privileges, root는 Docker
// socket을 읽는 Alloy만, memory는 infrastructure-target readiness의 백오피스 시작값, json-file 10MB × 3(bootstrap-owner는 log 없음),
// network는 고정 subnet 넷(publish·egress bridge, front·app internal)이고 direct routing 보호를 끄는 driver option이 없다.
// secret은 contract의 파일만 읽기 전용 파일 mount로 받는다(API 넷, Alloy 셋).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MiB = 1024 * 1024;
export const BACKOFFICE_MEMORY_LIMITS = Object.freeze({
  'backoffice-ingress': 96 * MiB,
  'backoffice-web': 256 * MiB,
  'backoffice-api': 512 * MiB,
  'bootstrap-owner': 256 * MiB,
  alloy: 96 * MiB,
});
export const PUBLISHED_PORT = Object.freeze({
  service: 'backoffice-ingress',
  hostIp: '127.0.0.1',
  published: '4300',
  target: 8080,
});
export const BACKOFFICE_NETWORKS = Object.freeze({
  'backoffice-publish': { subnet: '10.217.20.0/28', gateway: '10.217.20.1', internal: false },
  'backoffice-front': { subnet: '10.217.21.0/28', gateway: '10.217.21.1', internal: true },
  'backoffice-app': { subnet: '10.217.22.0/28', gateway: '10.217.22.1', internal: true },
  'backoffice-egress': { subnet: '10.217.23.0/28', gateway: '10.217.23.1', internal: false },
});
// Docker 기본 주소 pool(172.17~31.0.0/16, 192.168.0.0/16), AWS default VPC·Lightsail VPC 대역과 user host 묶음 network.
export const RESERVED_RANGES = Object.freeze([
  '172.16.0.0/12',
  '192.168.0.0/16',
  '10.217.10.0/28',
  '10.217.11.0/28',
  '10.217.12.0/28',
]);
const SERVICE_NETWORKS = Object.freeze({
  'backoffice-ingress': ['backoffice-front', 'backoffice-publish'],
  'backoffice-web': ['backoffice-app', 'backoffice-front'],
  'backoffice-api': ['backoffice-app', 'backoffice-egress'],
  'bootstrap-owner': ['backoffice-egress'],
  alloy: ['backoffice-app', 'backoffice-egress', 'backoffice-front'],
});
export const API_SECRET_TARGET = '/run/secrets/dormduri-backoffice';
export const ALLOY_SECRET_TARGET = '/run/secrets/dormduri-backoffice-observability';
export const ALLOY_HOST_READS = Object.freeze({
  '/var/run/docker.sock': '/var/run/docker.sock',
  '/': '/host/root',
  '/proc': '/host/proc',
  '/sys': '/host/sys',
});
export const BACKOFFICE_API_URL = 'http://backoffice-api:4310';
// validate-compose가 render에 넣는 값(registry digest 참조 모양과 host 경로).
export const BACKOFFICE_RENDER_ENVIRONMENT = Object.freeze({
  BACKOFFICE_API_IMAGE: `registry.invalid/dormduri/backoffice-api@sha256:${'1'.repeat(64)}`,
  BACKOFFICE_WEB_IMAGE: `registry.invalid/dormduri/backoffice-web@sha256:${'2'.repeat(64)}`,
  BACKOFFICE_INGRESS_IMAGE: `registry.invalid/dormduri/backoffice-ingress@sha256:${'3'.repeat(64)}`,
  BACKOFFICE_SECRET_RELEASE_DIR: '/opt/dormduri/secrets/backoffice/releases/validation',
  BACKOFFICE_OBSERVABILITY_SECRET_DIR: '/opt/dormduri/secrets/backoffice/observability/validation',
  BACKOFFICE_ALLOY_CONFIG_DIR: '/opt/dormduri/releases/backoffice/validation/alloy',
});

function cidrRange(cidr) {
  const [address, bits] = String(cidr).split('/');
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !(octet >= 0 && octet <= 255))) return null;
  const start = octets.reduce((value, octet) => value * 256 + octet, 0);
  const size = 2 ** (32 - Number(bits));
  const first = start - (start % size);
  return [first, first + size - 1];
}
export function overlaps(left, right) {
  const [a, b] = [cidrRange(left), cidrRange(right)];
  return Boolean(a && b && a[0] <= b[1] && b[0] <= a[1]);
}

const memory = (service) => Number(service.deploy?.resources?.limits?.memory);
const sorted = (values) => JSON.stringify([...values].sort());

function hardeningProblems(name, service) {
  const problems = [];
  if (service.read_only !== true) problems.push(`${name}: root filesystem is not read-only`);
  if (JSON.stringify(service.cap_drop ?? []) !== '["ALL"]')
    problems.push(`${name}: capabilities are not all dropped`);
  if (service.cap_add?.length) problems.push(`${name}: adds capabilities`);
  const options = service.security_opt ?? [];
  if (!options.includes('no-new-privileges:true'))
    problems.push(`${name}: no-new-privileges is not set`);
  if (options.some((option) => option !== 'no-new-privileges:true'))
    problems.push(`${name}: relaxes a security option`);
  for (const field of ['devices', 'device_cgroup_rules', 'sysctls', 'userns_mode', 'cgroup']) {
    const value = service[field];
    if (value !== undefined && !(typeof value === 'object' && !Object.keys(value).length))
      problems.push(`${name}: sets ${field}`);
  }
  if (service.privileged) problems.push(`${name}: runs privileged`);
  if (service.network_mode || service.pid || service.ipc)
    problems.push(`${name}: shares a host namespace`);
  if (name !== 'alloy' && /^(?:0|root)(?::|$)/u.test(String(service.user ?? '')))
    problems.push(`${name}: overrides the image user with root`);
  if (!(service.tmpfs ?? []).some((entry) => entry.startsWith('/tmp:')))
    problems.push(`${name}: /tmp is not a tmpfs`);
  if (memory(service) !== BACKOFFICE_MEMORY_LIMITS[name])
    problems.push(`${name}: memory limit differs from the infrastructure-target start value`);
  if (!Number.isInteger(service.deploy?.resources?.limits?.pids))
    problems.push(`${name}: no pids limit`);
  const restart = name === 'bootstrap-owner' ? 'no' : 'unless-stopped';
  if ((service.restart ?? 'no') !== restart)
    problems.push(`${name}: restart policy is not ${restart}`);
  const logging = service.logging ?? {};
  if (name === 'bootstrap-owner') {
    if (logging.driver !== 'none') problems.push(`${name}: keeps a log of the registration code`);
  } else if (
    logging.driver !== 'json-file' ||
    logging.options?.['max-size'] !== '10m' ||
    logging.options?.['max-file'] !== '3'
  ) {
    problems.push(`${name}: log rotation differs from json-file 10m x 3`);
  }
  const networks = Object.keys(service.networks ?? {});
  if (sorted(networks) !== JSON.stringify(SERVICE_NETWORKS[name]))
    problems.push(`${name}: networks ${networks.join(', ')} differ from ${SERVICE_NETWORKS[name]}`);
  for (const volume of service.volumes ?? []) {
    if (name !== 'alloy' && /docker\.sock/u.test(volume.source ?? ''))
      problems.push(`${name}: mounts the Docker socket`);
  }
  // Alloy(root·Docker socket)를 network로 긁는 쪽이 없으므로 HTTP server(UI·component API)는 container 안 loopback에만 연다.
  if (name === 'alloy') {
    const listen = (service.command ?? []).filter((arg) =>
      String(arg).startsWith('--server.http.listen-addr='),
    );
    if (listen.length !== 1 || listen[0] !== '--server.http.listen-addr=127.0.0.1:12345')
      problems.push(`${name}: the HTTP server listens beyond the container loopback`);
  }
  return problems;
}

// host publish는 정확히 한 줄이다.
export function publishProblems(services) {
  const problems = [];
  const all = Object.entries(services).flatMap(([name, service]) =>
    (service.ports ?? []).map((port) => ({ name, ...port })),
  );
  const expected = all.filter(
    (port) =>
      port.name === PUBLISHED_PORT.service &&
      port.host_ip === PUBLISHED_PORT.hostIp &&
      String(port.published) === PUBLISHED_PORT.published &&
      Number(port.target) === PUBLISHED_PORT.target &&
      (port.protocol ?? 'tcp') === 'tcp',
  );
  if (all.length !== 1 || expected.length !== 1) {
    problems.push(
      `ports: the bundle must publish only ${PUBLISHED_PORT.hostIp}:${PUBLISHED_PORT.published} -> ${PUBLISHED_PORT.target} of ${PUBLISHED_PORT.service}, got ${all.map((port) => `${port.name} ${port.host_ip || '(all)'}:${port.published}->${port.target}`).join(', ') || 'none'}`,
    );
  }
  for (const [name, service] of Object.entries(services)) {
    if (service.network_mode === 'host') problems.push(`${name}: uses the host network`);
  }
  return problems;
}

export function networkProblems(config) {
  const problems = [];
  const networks = config.networks ?? {};
  if (sorted(Object.keys(networks)) !== sorted(Object.keys(BACKOFFICE_NETWORKS)))
    problems.push(`networks: ${Object.keys(networks).join(', ')} differ from the fixed four`);
  for (const [key, expected] of Object.entries(BACKOFFICE_NETWORKS)) {
    const network = networks[key];
    if (!network) continue;
    const ipam = network.ipam?.config ?? [];
    if (
      network.external ||
      ipam.length !== 1 ||
      ipam[0].subnet !== expected.subnet ||
      ipam[0].gateway !== expected.gateway
    )
      problems.push(`networks: ${key} is not the fixed ${expected.subnet} subnet`);
    if (Boolean(network.internal) !== expected.internal)
      problems.push(`networks: ${key} internal is not ${expected.internal}`);
    // direct routing 보호를 끄는 bridge option(gateway_mode nat-unprotected·routed, trusted_host_interfaces 등)을 두지 않는다.
    if (network.driver_opts && Object.keys(network.driver_opts).length)
      problems.push(`networks: ${key} sets bridge driver options`);
    for (const reserved of RESERVED_RANGES) {
      if (overlaps(expected.subnet, reserved) || overlaps(ipam[0]?.subnet, reserved))
        problems.push(`networks: ${key} overlaps ${reserved}`);
    }
  }
  return problems;
}

function secretMountProblems(name, service, { sourceRoot, target, files }) {
  const problems = [];
  const mounted = [];
  for (const volume of service.volumes ?? []) {
    if (!String(volume.target ?? '').startsWith(`${target}/`)) continue;
    const file = volume.target.slice(target.length + 1);
    mounted.push(file);
    if (
      volume.type !== 'bind' ||
      volume.read_only !== true ||
      volume.bind?.create_host_path !== false ||
      volume.source !== `${sourceRoot}/${file}`
    )
      problems.push(`${name}: ${volume.target} is not a read-only file mount of its secret`);
  }
  if (sorted(mounted) !== sorted(files))
    problems.push(`${name}: secret mounts ${mounted.join(', ')} differ from ${files.join(', ')}`);
  return problems;
}

// pins: { alloy: <image reference> }. contract는 infra/deploy/backoffice-api/secret-mount.contract.json이다.
export function checkBackofficeCompose(config, { contract, pins = {}, environment }) {
  const services = config.services ?? {};
  const problems = [];
  if (config.name !== 'dormduri-backoffice')
    problems.push('name: the project is not dormduri-backoffice');
  if (sorted(Object.keys(services)) !== sorted(Object.keys(BACKOFFICE_MEMORY_LIMITS))) {
    problems.push(`services ${Object.keys(services).join(', ')} differ from the backoffice five`);
    return problems;
  }
  for (const [name, service] of Object.entries(services))
    problems.push(...hardeningProblems(name, service));
  problems.push(...publishProblems(services), ...networkProblems(config));

  const ingress = services['backoffice-ingress'];
  if (ingress.volumes?.length) problems.push('backoffice-ingress: mounts a host path');
  if (!ingress.healthcheck?.test?.some?.((part) => String(part).includes(':8081/__ingress/health')))
    problems.push('backoffice-ingress: healthcheck does not probe the private health location');

  const web = services['backoffice-web'];
  if (web.volumes?.length) problems.push('backoffice-web: mounts a host path');
  if (web.environment?.BACKOFFICE_API_URL !== BACKOFFICE_API_URL)
    problems.push('backoffice-web: BACKOFFICE_API_URL is not the internal backoffice API');
  if (web.environment?.NODE_ENV !== 'production')
    problems.push('backoffice-web: NODE_ENV is not production');

  const api = services['backoffice-api'];
  if (api.environment?.NODE_ENV !== 'production')
    problems.push('backoffice-api: NODE_ENV is not production');
  const apiSecrets = {
    sourceRoot: environment.BACKOFFICE_SECRET_RELEASE_DIR,
    target: API_SECRET_TARGET,
    files: contract.apiFiles,
  };
  problems.push(...secretMountProblems('backoffice-api', api, apiSecrets));
  if ((api.volumes ?? []).length !== contract.apiFiles.length)
    problems.push('backoffice-api: mounts more than its secret files');

  const bootstrap = services['bootstrap-owner'];
  if (JSON.stringify(bootstrap.profiles ?? []) !== '["bootstrap"]')
    problems.push('bootstrap-owner: is not behind the bootstrap profile');
  if (bootstrap.image !== api.image) problems.push('bootstrap-owner: does not run the API image');
  if (!(bootstrap.entrypoint ?? []).includes('dist/cli/bootstrap-owner.js'))
    problems.push('bootstrap-owner: does not run the bootstrap-owner command');
  problems.push(...secretMountProblems('bootstrap-owner', bootstrap, apiSecrets));
  if ((bootstrap.volumes ?? []).length !== contract.apiFiles.length)
    problems.push('bootstrap-owner: mounts more than its secret files');
  for (const [name, service] of Object.entries(services)) {
    if (name !== 'bootstrap-owner' && service.profiles?.length)
      problems.push(`${name}: is behind a profile`);
  }

  const alloy = services.alloy;
  if (pins.alloy && alloy.image !== pins.alloy)
    problems.push('alloy: image differs from the observability pin');
  if (!/@sha256:[a-f0-9]{64}$/u.test(alloy.image ?? ''))
    problems.push('alloy: image is not pinned by digest');
  if (String(alloy.user ?? '') !== '0:473') problems.push('alloy: user is not 0:473');
  if (!alloy.deploy?.resources?.limits?.cpus) problems.push('alloy: no CPU limit');
  problems.push(
    ...secretMountProblems('alloy', alloy, {
      sourceRoot: environment.BACKOFFICE_OBSERVABILITY_SECRET_DIR,
      target: ALLOY_SECRET_TARGET,
      files: contract.observabilityFiles,
    }),
  );
  for (const volume of alloy.volumes ?? []) {
    const source = volume.source ?? '';
    if (volume.type === 'volume' || String(volume.target).startsWith(`${ALLOY_SECRET_TARGET}/`))
      continue;
    if (ALLOY_HOST_READS[source] === volume.target) {
      if (volume.read_only !== true) problems.push(`alloy: ${source} is writable`);
    } else if (
      source === environment.BACKOFFICE_ALLOY_CONFIG_DIR &&
      volume.target === '/etc/alloy'
    ) {
      if (volume.read_only !== true) problems.push('alloy: the config directory is writable');
    } else problems.push(`alloy: mounts ${source || volume.target} outside its paths`);
  }
  if (
    (alloy.volumes ?? []).filter((volume) => ALLOY_HOST_READS[volume.source]).length !==
    Object.keys(ALLOY_HOST_READS).length
  )
    problems.push('alloy: does not read the Docker socket and host paths read-only');
  return problems;
}

// 계약 owner 파일을 읽는다(validate-compose와 test가 같은 기준을 쓴다).
export function readSecretContract(repoRoot) {
  return JSON.parse(
    readFileSync(
      resolve(repoRoot, 'infra/deploy/backoffice-api/secret-mount.contract.json'),
      'utf8',
    ),
  );
}
