// User host compose 조각 둘(web 묶음 infra/deploy/user/compose.yml, API 묶음 infra/deploy/user/api/compose.yml)의 구조 계약.
// `docker compose config --format json` 결과를 받아 어긋난 점의 목록을 돌려준다(빈 목록 = 통과). validate-compose가 실제
// 파일에, test가 fixture에 쓴다.
// 기준: web·API publish 없음(ingress 80·443만), read-only root·tmpfs·non-root image·no-new-privileges, memory는
// infrastructure-target readiness의 시작값(nginx 96MiB·Web 320MiB·API 1408MiB), json-file 10MB × 3, network는 Web transit
// (web·ingress, 고정 subnet·주소)과 묶음을 건너는 external API transit(ingress·api·migrate)뿐(D-AB11·D-AB13).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const USER_HOST_MEMORY_LIMITS = Object.freeze({
  web: 320 * 1024 * 1024,
  ingress: 96 * 1024 * 1024,
  api: 1408 * 1024 * 1024,
  migrate: 384 * 1024 * 1024,
});
// Web transit: web 조각이 정의한다. 고정 주소는 동적 할당 범위 밖이고, ingress private listener는 web 주소와 loopback만 받고
// 그 밖의 peer에는 403을 낸다(infra/deploy/user/ingress/conf.d/dormduri.conf). API transit: 두 document가 lib.sh 값으로 만들고
// 조각은 external로만 쓴다(transitSubnetProblems가 lib.sh 값과 대조한다).
export const WEB_TRANSIT = Object.freeze({
  key: 'web-transit',
  subnet: '10.217.10.0/28',
  ipRange: '10.217.10.8/29',
  gateway: '10.217.10.1',
  web: '10.217.10.2',
  ingress: '10.217.10.3',
});
export const API_TRANSIT = Object.freeze({
  key: 'api-transit',
  name: 'dormduri-api-transit',
  subnet: '10.217.11.0/28',
  ipRange: '10.217.11.8/29',
  gateway: '10.217.11.1',
});
// Docker 기본 주소 pool(172.17~31.0.0/16, 192.168.0.0/16)과 AWS 기본 VPC(default VPC·Lightsail VPC 대역)를 덮는 범위. transit이
// 여기와 겹치면 RDS·Lightsail 경로가 bridge로 잘못 가거나 다른 docker network와 부딪친다(D-AB11).
export const TRANSIT_RESERVED_RANGES = Object.freeze(['172.16.0.0/12', '192.168.0.0/16']);

function cidrRange(cidr) {
  const [address, bits] = cidr.split('/');
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !(octet >= 0 && octet <= 255)) ||
    !(Number(bits) >= 0)
  )
    return null;
  const start = octets.reduce((value, octet) => value * 256 + octet, 0);
  const size = 2 ** (32 - Number(bits));
  const first = start - (start % size);
  return [first, first + size - 1];
}

const overlaps = (a, b) => {
  const [left, right] = [cidrRange(a), cidrRange(b)];
  return Boolean(left && right && left[0] <= right[1] && right[0] <= left[1]);
};

// API transit 값의 원본은 lib.sh(두 document가 network를 없을 때 만든다)다. 조각은 external로만 써서 render로 대조할 수 없으므로
// 그 값을 계약과 대조하고, 두 transit이 서로·예약 범위와 겹치지 않는지 본다.
export function transitSubnetProblems(libText, api = API_TRANSIT, web = WEB_TRANSIT) {
  const problems = [];
  const expected = {
    api_transit_name: api.name,
    api_transit_subnet: api.subnet,
    api_transit_range: api.ipRange,
    api_transit_gateway: api.gateway,
  };
  for (const [key, value] of Object.entries(expected)) {
    const match = new RegExp(`^${key}=(\\S+)$`, 'mu').exec(libText);
    if (match?.[1] !== value)
      problems.push(`lib.sh ${key} is ${match?.[1] ?? 'missing'}, not ${value}`);
  }
  if (overlaps(api.subnet, web.subnet))
    problems.push(`API transit ${api.subnet} overlaps Web transit ${web.subnet}`);
  for (const [name, subnet] of [
    ['API transit', api.subnet],
    ['Web transit', web.subnet],
  ]) {
    for (const reserved of TRANSIT_RESERVED_RANGES) {
      if (overlaps(subnet, reserved)) problems.push(`${name} ${subnet} overlaps ${reserved}`);
    }
  }
  return problems;
}
export const API_SECRET_TARGET = '/run/secrets/dormduri-api';
export const MIGRATE_SECRET_TARGET = '/run/secrets/dormduri-migrate';
export const MIGRATE_SECRET_FILES = Object.freeze([
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'RETENTION_DISCLOSURE_DATABASE_URL',
  'RETENTION_WORKER_DATABASE_URL',
]);
// 운영 compose는 배포 document가 넣는 registry digest 참조와 release 경로를 받는다. local render는 같은 형식의 placeholder를 쓴다.
export const USER_HOST_RENDER_ENVIRONMENT = Object.freeze({
  WEB_IMAGE: `dormduri/web@sha256:${'0'.repeat(64)}`,
  INGRESS_IMAGE: `dormduri/ingress@sha256:${'0'.repeat(64)}`,
  WEB_RELEASE: 'web-000000000000',
  API_IMAGE: `dormduri/api@sha256:${'0'.repeat(64)}`,
  API_MIGRATE_IMAGE: `dormduri/api-migrate@sha256:${'0'.repeat(64)}`,
  API_SECRET_RELEASE_DIR: '/opt/dormduri/secrets/api/releases/render',
  MIGRATE_SECRET_DIR: '/opt/dormduri/secrets/migrate.render',
});
export const INGRESS_PUBLISHED_PORTS = Object.freeze(['80:8080', '443:8443']);
export const INGRESS_READ_ONLY_MOUNTS = Object.freeze([
  '/etc/dormduri-tls',
  '/run/dormduri-mode',
  '/var/www/acme',
]);
const SERVICE_NETWORKS = Object.freeze({
  web: [WEB_TRANSIT.key],
  ingress: [API_TRANSIT.key, WEB_TRANSIT.key],
  api: [API_TRANSIT.key],
  migrate: [API_TRANSIT.key],
});

const memory = (service) => Number(service.deploy?.resources?.limits?.memory);
const seconds = (value) => {
  const match = /^(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/u.exec(String(value ?? ''));
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : Number.NaN;
};

function hardeningProblems(name, service, { restart = 'unless-stopped' } = {}) {
  const problems = [];
  if (service.read_only !== true) problems.push(`${name}: root filesystem is not read-only`);
  if (JSON.stringify(service.cap_drop ?? []) !== '["ALL"]')
    problems.push(`${name}: capabilities are not all dropped`);
  if (service.cap_add?.length) problems.push(`${name}: adds capabilities`);
  if (!(service.security_opt ?? []).includes('no-new-privileges:true')) {
    problems.push(`${name}: no-new-privileges is not set`);
  }
  if (service.privileged) problems.push(`${name}: runs privileged`);
  if (service.network_mode || service.pid || service.ipc)
    problems.push(`${name}: shares a host namespace`);
  if (service.user !== undefined && /^(?:0|root)(?::|$)/u.test(String(service.user))) {
    problems.push(`${name}: overrides the image user with root`);
  }
  if (!(service.tmpfs ?? []).some((entry) => entry.startsWith('/tmp:')))
    problems.push(`${name}: /tmp is not a tmpfs`);
  if (memory(service) !== USER_HOST_MEMORY_LIMITS[name]) {
    problems.push(`${name}: memory limit differs from the infrastructure-target start value`);
  }
  if (!Number.isInteger(service.deploy?.resources?.limits?.pids))
    problems.push(`${name}: no pids limit`);
  if ((service.restart ?? 'no') !== restart)
    problems.push(`${name}: restart policy is not ${restart}`);
  const logging = service.logging ?? {};
  if (
    logging.driver !== 'json-file' ||
    logging.options?.['max-size'] !== '10m' ||
    logging.options?.['max-file'] !== '3'
  ) {
    problems.push(`${name}: log rotation differs from json-file 10m x 3`);
  }
  const networks = Object.keys(service.networks ?? {}).sort();
  if (JSON.stringify(networks) !== JSON.stringify(SERVICE_NETWORKS[name])) {
    problems.push(`${name}: networks ${networks.join(', ')} differ from ${SERVICE_NETWORKS[name]}`);
  }
  for (const volume of service.volumes ?? []) {
    if (/docker\.sock/u.test(volume.source ?? ''))
      problems.push(`${name}: mounts the Docker socket`);
  }
  if (name !== 'ingress' && service.ports?.length) problems.push(`${name}: publishes a host port`);
  return problems;
}

function networkProblems(config) {
  const problems = [];
  const networks = config.networks ?? {};
  // 옛 production `web` network는 옛 형식 release가 쓰는 정의다. 새 조각은 다시 정의하지 않는다.
  if (Object.prototype.hasOwnProperty.call(networks, 'web'))
    problems.push('networks: redefines the old web network');
  const transit = networks[WEB_TRANSIT.key];
  const ipam = transit?.ipam?.config ?? [];
  if (
    transit?.external ||
    ipam.length !== 1 ||
    ipam[0].subnet !== WEB_TRANSIT.subnet ||
    ipam[0].ip_range !== WEB_TRANSIT.ipRange ||
    ipam[0].gateway !== WEB_TRANSIT.gateway
  ) {
    problems.push('networks: web-transit is not the fixed Web transit subnet');
  }
  const api = networks[API_TRANSIT.key];
  if (api?.external !== true || api?.name !== API_TRANSIT.name)
    problems.push(`networks: api-transit is not the external ${API_TRANSIT.name}`);
  return problems;
}

// web 묶음 조각만 render한 결과.
export function checkUserHostCompose(config) {
  const services = config.services ?? {};
  const problems = [];
  if (JSON.stringify(Object.keys(services).sort()) !== '["ingress","web"]') {
    problems.push(
      `services must be exactly ingress and web, got ${Object.keys(services).join(', ')}`,
    );
    return problems;
  }
  const { web, ingress } = services;
  problems.push(...hardeningProblems('web', web), ...hardeningProblems('ingress', ingress));
  problems.push(...networkProblems(config));
  if (web.volumes?.length) problems.push('web: mounts a host path');
  if (web.networks?.[WEB_TRANSIT.key]?.ipv4_address !== WEB_TRANSIT.web)
    problems.push(`web: Web transit address is not ${WEB_TRANSIT.web}`);
  if (ingress.networks?.[WEB_TRANSIT.key]?.ipv4_address !== WEB_TRANSIT.ingress)
    problems.push(`ingress: Web transit address is not ${WEB_TRANSIT.ingress}`);
  const environment = web.environment ?? {};
  if (environment.API_URL !== 'http://ingress:8081')
    problems.push('web: API_URL is not the private ingress listener');
  if (!/^https:\/\//u.test(environment.WEB_APP_URL ?? ''))
    problems.push('web: WEB_APP_URL is not https');
  if (environment.NODE_ENV !== 'production') problems.push('web: NODE_ENV is not production');
  const published = (ingress.ports ?? []).map((port) => `${port.published}:${port.target}`).sort();
  if (JSON.stringify(published) !== JSON.stringify([...INGRESS_PUBLISHED_PORTS].sort())) {
    problems.push(`ingress: published ports ${published.join(', ')} differ from 80 and 443`);
  }
  const mounts = (ingress.volumes ?? []).map((volume) => volume.target).sort();
  if (JSON.stringify(mounts) !== JSON.stringify([...INGRESS_READ_ONLY_MOUNTS])) {
    problems.push(
      `ingress: mounts ${mounts.join(', ')} differ from the TLS, mode and ACME directories`,
    );
  }
  for (const volume of ingress.volumes ?? []) {
    if (volume.read_only !== true) problems.push(`ingress: ${volume.target} is writable`);
  }
  if (
    !ingress.healthcheck?.test?.some?.((part) => String(part).includes(':8081/__ingress/health'))
  ) {
    problems.push('ingress: healthcheck does not probe the private health location');
  }
  return problems;
}

// 두 조각을 한 project로 render한 결과. expectedEnvironment는 apiEnvironmentFromExamples()다.
export function checkUserHostBundleCompose(config, expectedEnvironment) {
  const services = config.services ?? {};
  if (JSON.stringify(Object.keys(services).sort()) !== '["api","ingress","migrate","web"]') {
    return [
      `services must be exactly api, ingress, migrate and web, got ${Object.keys(services).join(', ')}`,
    ];
  }
  const webOnly = { ...config, services: { web: services.web, ingress: services.ingress } };
  const problems = checkUserHostCompose(webOnly);
  const { api, migrate } = services;
  problems.push(
    ...hardeningProblems('api', api),
    ...hardeningProblems('migrate', migrate, { restart: 'no' }),
  );
  if (!(seconds(api.stop_grace_period) >= 30))
    problems.push('api: stop_grace_period is shorter than 30s');
  if (api.profiles?.length) problems.push('api: is behind a profile');
  if (JSON.stringify(migrate.profiles ?? []) !== '["migrate"]')
    problems.push('migrate: is not a migrate-profile one-off');
  const apiVolumes = api.volumes ?? [];
  if (
    apiVolumes.length !== 1 ||
    apiVolumes[0].type !== 'bind' ||
    apiVolumes[0].target !== API_SECRET_TARGET ||
    apiVolumes[0].read_only !== true ||
    apiVolumes[0].bind?.create_host_path !== false ||
    !/^\/opt\/dormduri\/secrets\/api\/releases\/[^/]+$/u.test(apiVolumes[0].source ?? '')
  ) {
    problems.push(
      `api: mounts something other than one read-only secret release at ${API_SECRET_TARGET}`,
    );
  }
  const migrateVolumes = migrate.volumes ?? [];
  const targets = migrateVolumes.map((volume) => volume.target).sort();
  if (
    JSON.stringify(targets) !==
    JSON.stringify(MIGRATE_SECRET_FILES.map((name) => `${MIGRATE_SECRET_TARGET}/${name}`))
  ) {
    problems.push('migrate: secret mounts are not exactly the four files');
  }
  for (const volume of migrateVolumes) {
    const name = volume.target?.split('/').pop();
    if (
      volume.type !== 'bind' ||
      volume.read_only !== true ||
      volume.bind?.create_host_path !== false ||
      !volume.source?.endsWith(`/${name}`) ||
      volume.source.startsWith('/opt/dormduri/secrets/api/')
    ) {
      problems.push(
        `migrate: ${volume.target} is not a read-only file mount from the temporary directory`,
      );
    }
  }
  for (const volume of apiVolumes) {
    if (/migrat/u.test(volume.source ?? '')) problems.push('api: mounts the migration secret');
  }
  if (migrate.environment?.CHECKPOINT_DISABLE !== '1')
    problems.push('migrate: CHECKPOINT_DISABLE=1 is not set');
  if (migrate.environment?.MIGRATE_SECRET_DIRECTORY !== MIGRATE_SECRET_TARGET)
    problems.push('migrate: MIGRATE_SECRET_DIRECTORY is not the file mount directory');
  if (!api.healthcheck?.test?.some?.((part) => String(part).includes('healthcheck.sh')))
    problems.push('api: healthcheck does not run the readiness probe');
  const environment = api.environment ?? {};
  for (const [key, value] of Object.entries(expectedEnvironment ?? {})) {
    if (environment[key] !== value)
      problems.push(`api: env ${key} differs from the Lightsail example`);
  }
  for (const key of Object.keys(environment)) {
    if (!(key in (expectedEnvironment ?? {})))
      problems.push(`api: env ${key} is not in the Lightsail example`);
  }
  return problems;
}

// 조각 원문의 규칙: web 조각만 top-level `name: dormduri-web`, 상대 경로·env_file·build 없음(두 조각을 서로 다른 release
// 디렉터리에서 함께 넘기므로 상대 경로는 조각 위치에 따라 달리 풀린다).
export function fragmentTextProblems({ web, api }) {
  const problems = [];
  if (!/^name: dormduri-web$/mu.test(web)) problems.push('web fragment: name is not dormduri-web');
  if (/^name:/mu.test(api)) problems.push('api fragment: has a top-level name');
  for (const [label, text] of [
    ['web fragment', web],
    ['api fragment', api],
  ]) {
    for (const line of text.split('\n')) {
      if (/^\s*#/u.test(line)) continue;
      if (/^\s*(?:env_file|build|context|extends):/u.test(line))
        problems.push(`${label}: uses a file path key (${line.trim()})`);
      if (/(?:^|[\s:'"])\.{1,2}\//u.test(line) || /^\s*-\s*[A-Za-z0-9_.-]+:\//u.test(line))
        problems.push(`${label}: has a relative path (${line.trim()})`);
    }
  }
  return problems;
}

function envEntries(path) {
  const entries = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    entries[line.slice(0, index)] = line.slice(index + 1);
  }
  return entries;
}

// API 조각의 비밀 아닌 env: Lightsail 예시, 그다음 그 예시가 따르는 runtime 예시의 나머지 key. secret-mount contract의 key와
// compose interpolation 입력(API_SECRET_HOST_CURRENT), aws-secrets-manager 전용 key(SECRET_NAME_PREFIX)는 뺀다.
export function apiEnvironmentFromExamples(repoRoot) {
  const secrets = new Set(
    JSON.parse(
      readFileSync(resolve(repoRoot, 'infra/deploy/api/secret-mount.contract.json'), 'utf8'),
    ).requiredFiles,
  );
  const excluded = new Set(['API_SECRET_HOST_CURRENT', 'SECRET_NAME_PREFIX']);
  const environment = {};
  for (const path of ['infra/deploy/.env.api.lightsail.example', 'infra/deploy/.env.api.example']) {
    for (const [key, value] of Object.entries(envEntries(resolve(repoRoot, path)))) {
      if (secrets.has(key) || excluded.has(key) || key in environment) continue;
      environment[key] = value;
    }
  }
  return environment;
}

// Local rehearsal이 운영 render에서 바꿔도 되는 곳: project·network 이름, local build(image 출처), ingress의 loopback
// publish port와 host 경로 source, API transit을 project 안 network로 바꾸는 것. 그 밖(env, hardening, mount
// target·read_only, service 구성, Web transit 주소)이 다르면 rehearsal은 운영 구성을 시험하지 못한다.
const REHEARSAL_DIFFERENCES = [
  /^\.name$/u,
  /^\.networks\.[^.]+\.name$/u,
  /^\.networks\.api-transit\.external$/u,
  /^\.services\.[^.]+\.(?:build|image)(?:\.|\[|$)/u,
  /^\.services\.ingress\.ports\[\d+\]\.(?:host_ip|published)$/u,
  /^\.services\.ingress\.volumes\[\d+\]\.source$/u,
];

function differences(left, right, path, out) {
  if (Array.isArray(left) && Array.isArray(right) && left.length === right.length) {
    left.forEach((item, index) => differences(item, right[index], `${path}[${index}]`, out));
  } else if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      differences(left[key], right[key], `${path}.${key}`, out);
    }
  } else if (JSON.stringify(left) !== JSON.stringify(right)) out.push(path);
  return out;
}

export function rehearsalDifferenceProblems(production, rehearsal) {
  const problems = differences(production, rehearsal, '', [])
    .filter((path) => !REHEARSAL_DIFFERENCES.some((pattern) => pattern.test(path)))
    .map((path) => `rehearsal differs from the host compose at ${path}`);
  for (const port of rehearsal.services?.ingress?.ports ?? []) {
    if (port.host_ip !== '127.0.0.1')
      problems.push(`rehearsal publishes ingress ${port.target} beyond loopback`);
  }
  return problems;
}
