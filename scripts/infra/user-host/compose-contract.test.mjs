import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  API_TRANSIT,
  apiEnvironmentFromExamples,
  checkUserHostBundleCompose,
  checkUserHostCompose,
  fragmentTextProblems,
  MIGRATE_SECRET_FILES,
  rehearsalDifferenceProblems,
  transitSubnetProblems,
  WEB_TRANSIT,
} from './compose-contract.mjs';

const repoRoot = process.cwd();

// The shape `docker compose config --format json` renders for the user host fragments. validate-compose runs the same
// checks on the real files; these fixtures prove each check rejects a weakened boundary.
function hardened(memory, pids, networks) {
  return {
    read_only: true,
    cap_drop: ['ALL'],
    security_opt: ['no-new-privileges:true'],
    restart: 'unless-stopped',
    networks,
    logging: { driver: 'json-file', options: { 'max-file': '3', 'max-size': '10m' } },
    deploy: { resources: { limits: { memory: String(memory), pids } } },
  };
}

function networks() {
  return {
    [API_TRANSIT.key]: { name: API_TRANSIT.name, ipam: {}, external: true },
    [WEB_TRANSIT.key]: {
      name: `dormduri-web_${WEB_TRANSIT.key}`,
      driver: 'bridge',
      ipam: {
        config: [
          {
            subnet: WEB_TRANSIT.subnet,
            gateway: WEB_TRANSIT.gateway,
            ip_range: WEB_TRANSIT.ipRange,
          },
        ],
      },
    },
  };
}

function validConfig() {
  return {
    networks: networks(),
    services: {
      web: {
        ...hardened(335544320, 256, { [WEB_TRANSIT.key]: { ipv4_address: WEB_TRANSIT.web } }),
        tmpfs: ['/tmp:size=64m,mode=1777', '/app/apps/web/.next/cache:size=128m,mode=1777'],
        environment: {
          NODE_ENV: 'production',
          WEB_APP_URL: 'https://dormduri.com',
          API_URL: 'http://ingress:8081',
        },
        expose: ['3000'],
      },
      ingress: {
        ...hardened(100663296, 128, {
          [API_TRANSIT.key]: {},
          [WEB_TRANSIT.key]: { ipv4_address: WEB_TRANSIT.ingress },
        }),
        tmpfs: ['/tmp:size=16m,mode=1777'],
        ports: [
          { target: 8080, published: '80', protocol: 'tcp' },
          { target: 8443, published: '443', protocol: 'tcp' },
        ],
        volumes: ['/var/www/acme', '/etc/dormduri-tls', '/run/dormduri-mode'].map((target) => ({
          type: 'bind',
          source: `/opt/dormduri/${target.split('/').pop()}`,
          target,
          read_only: true,
        })),
        healthcheck: {
          test: ['CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8081/__ingress/health'],
        },
      },
    },
  };
}

const API_ENVIRONMENT = Object.freeze({
  NODE_ENV: 'production',
  SECRET_SOURCE: 'mounted-files',
  DATABASE_POOL_MAX: '7',
});

function validBundle() {
  const config = validConfig();
  const fileMount = (name) => ({
    type: 'bind',
    source: `/opt/dormduri/secrets/migrate.render/${name}`,
    target: `/run/secrets/dormduri-migrate/${name}`,
    read_only: true,
    bind: { create_host_path: false },
  });
  config.services.api = {
    ...hardened(1476395008, 512, { [API_TRANSIT.key]: {} }),
    tmpfs: ['/tmp:size=64m,mode=1777'],
    environment: { ...API_ENVIRONMENT },
    stop_grace_period: '30s',
    healthcheck: { test: ['CMD', '/app/healthcheck.sh'] },
    volumes: [
      {
        type: 'bind',
        source: '/opt/dormduri/secrets/api/releases/render',
        target: '/run/secrets/dormduri-api',
        read_only: true,
        bind: { create_host_path: false },
      },
    ],
  };
  config.services.migrate = {
    ...hardened(402653184, 256, { [API_TRANSIT.key]: {} }),
    restart: 'no',
    profiles: ['migrate'],
    tmpfs: ['/tmp:size=64m,mode=1777'],
    environment: {
      NODE_ENV: 'production',
      CHECKPOINT_DISABLE: '1',
      MIGRATE_SECRET_DIRECTORY: '/run/secrets/dormduri-migrate',
    },
    volumes: MIGRATE_SECRET_FILES.map(fileMount),
  };
  return config;
}

function withChange(change) {
  const config = validConfig();
  change(config.services, config);
  return checkUserHostCompose(config);
}

function bundleWithChange(change) {
  const config = validBundle();
  change(config.services, config);
  return checkUserHostBundleCompose(config, API_ENVIRONMENT);
}

function assertRejected(problemsOf, cases) {
  for (const [change, expected] of cases) {
    const problems = problemsOf(change);
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
}

test('the hardened web bundle fragment shape passes', () => {
  assert.deepEqual(checkUserHostCompose(validConfig()), []);
});

test('each weakened web bundle boundary is rejected', () => {
  assertRejected(withChange, [
    [(s) => (s.web.ports = [{ target: 3000, published: '3000' }]), /web: publishes a host port/u],
    [
      (s) => (s.web.volumes = [{ type: 'bind', source: '/srv', target: '/srv' }]),
      /web: mounts a host path/u,
    ],
    [(s) => (s.web.read_only = false), /web: root filesystem is not read-only/u],
    [(s) => (s.ingress.cap_drop = []), /ingress: capabilities are not all dropped/u],
    [(s) => (s.web.cap_add = ['NET_ADMIN']), /web: adds capabilities/u],
    [(s) => (s.ingress.security_opt = []), /ingress: no-new-privileges is not set/u],
    [(s) => (s.web.privileged = true), /web: runs privileged/u],
    [(s) => (s.ingress.network_mode = 'host'), /ingress: shares a host namespace/u],
    [(s) => (s.web.user = '0:0'), /web: overrides the image user with root/u],
    [(s) => (s.web.tmpfs = []), /web: \/tmp is not a tmpfs/u],
    [(s) => (s.web.deploy.resources.limits.memory = '536870912'), /web: memory limit differs/u],
    [(s) => delete s.ingress.deploy.resources.limits.pids, /ingress: no pids limit/u],
    [(s) => (s.web.logging.options['max-size'] = '100m'), /web: log rotation differs/u],
    // Web stays on the Web transit only; it never reaches the API transit directly.
    [(s) => (s.web.networks[API_TRANSIT.key] = {}), /web: networks .* differ/u],
    [(s) => delete s.ingress.networks[API_TRANSIT.key], /ingress: networks .* differ/u],
    [
      (s) => (s.web.networks[WEB_TRANSIT.key].ipv4_address = '10.217.10.9'),
      /web: Web transit address is not/u,
    ],
    [
      (s) => delete s.ingress.networks[WEB_TRANSIT.key].ipv4_address,
      /ingress: Web transit address is not/u,
    ],
    [
      (s, c) => (c.networks.web = { name: 'dormduri-web_web', driver: 'bridge' }),
      /redefines the old web network/u,
    ],
    [
      (s, c) => (c.networks[WEB_TRANSIT.key].ipam.config[0].subnet = '172.31.0.0/16'),
      /web-transit is not the fixed Web transit subnet/u,
    ],
    [
      (s, c) => delete c.networks[API_TRANSIT.key].external,
      /api-transit is not the external dormduri-api-transit/u,
    ],
    [
      (s) => (s.web.environment.API_URL = 'https://api.dormduri.com'),
      /web: API_URL is not the private ingress listener/u,
    ],
    [
      (s) => (s.web.environment.WEB_APP_URL = 'http://dormduri.com'),
      /web: WEB_APP_URL is not https/u,
    ],
    [(s) => s.ingress.ports.push({ target: 8081, published: '8081' }), /ingress: published ports/u],
    [(s) => (s.ingress.volumes[1].read_only = false), /ingress: \/etc\/dormduri-tls is writable/u],
    [
      (s) =>
        s.ingress.volumes.push({
          type: 'bind',
          source: '/var/run/docker.sock',
          target: '/var/run/docker.sock',
          read_only: true,
        }),
      /ingress: mounts the Docker socket/u,
    ],
    [(s) => (s.ingress.healthcheck = undefined), /ingress: healthcheck does not probe/u],
    [(s) => (s.api = {}), /services must be exactly ingress and web/u],
  ]);
});

test('the hardened API bundle fragment shape passes together with the web fragment', () => {
  assert.deepEqual(checkUserHostBundleCompose(validBundle(), API_ENVIRONMENT), []);
});

test('each weakened API bundle boundary is rejected', () => {
  assertRejected(bundleWithChange, [
    [(s) => (s.api.ports = [{ target: 4000, published: '4000' }]), /api: publishes a host port/u],
    [
      (s) => (s.migrate.ports = [{ target: 5432, published: '5432' }]),
      /migrate: publishes a host port/u,
    ],
    [(s) => (s.api.read_only = false), /api: root filesystem is not read-only/u],
    [(s) => (s.migrate.user = 'root'), /migrate: overrides the image user with root/u],
    [(s) => (s.api.deploy.resources.limits.memory = '2147483648'), /api: memory limit differs/u],
    [(s) => (s.api.stop_grace_period = '15s'), /api: stop_grace_period is shorter than 30s/u],
    [(s) => delete s.api.stop_grace_period, /api: stop_grace_period is shorter than 30s/u],
    [(s) => (s.api.networks['web-transit'] = {}), /api: networks .* differ/u],
    [(s) => (s.migrate.profiles = []), /migrate: is not a migrate-profile one-off/u],
    [(s) => (s.migrate.restart = 'unless-stopped'), /migrate: restart policy is not no/u],
    [
      (s) => (s.api.volumes[0].read_only = false),
      /api: mounts something other than one read-only/u,
    ],
    // The migration secret never reaches the API container.
    [
      (s) =>
        s.api.volumes.push({
          type: 'bind',
          source: '/opt/dormduri/secrets/migrate.render/MIGRATION_DATABASE_URL',
          target: '/run/secrets/dormduri-migrate/MIGRATION_DATABASE_URL',
          read_only: true,
        }),
      /api: mounts the migration secret/u,
    ],
    // The one-off gets the four files, not a directory and not the runtime release directory.
    [
      (s) =>
        (s.migrate.volumes = [
          {
            type: 'bind',
            source: '/opt/dormduri/secrets/migrate.render',
            target: '/run/secrets/dormduri-migrate',
            read_only: true,
            bind: { create_host_path: false },
          },
        ]),
      /migrate: secret mounts are not exactly the four files/u,
    ],
    [
      (s) =>
        (s.migrate.volumes[1].source = '/opt/dormduri/secrets/api/releases/render/DATABASE_URL'),
      /migrate: .* is not a read-only file mount from the temporary directory/u,
    ],
    [(s) => (s.migrate.volumes[2].read_only = false), /migrate: .* is not a read-only file mount/u],
    [
      (s) => delete s.migrate.environment.CHECKPOINT_DISABLE,
      /migrate: CHECKPOINT_DISABLE=1 is not set/u,
    ],
    [(s) => (s.api.healthcheck = undefined), /api: healthcheck does not run the readiness probe/u],
    [(s) => (s.api.environment.DATABASE_POOL_MAX = '10'), /api: env DATABASE_POOL_MAX differs/u],
    [(s) => (s.api.environment.EXTRA = 'x'), /api: env EXTRA is not in the Lightsail example/u],
    [(s) => delete s.migrate, /services must be exactly api, ingress, migrate and web/u],
  ]);
});

// API transit은 조각에서 external이라 render 결과로 대조할 수 없다. 값의 원본은 두 document가 network를 만드는 lib.sh다.
test('the API transit values in lib.sh are the contract values and no transit overlaps Docker pools or AWS default VPCs', () => {
  const lib = readFileSync(resolve(repoRoot, 'infra/deploy/user/ssm/lib.sh'), 'utf8');
  assert.deepEqual(transitSubnetProblems(lib), []);
  const changed = (from, to) => transitSubnetProblems(lib.replace(from, to));
  assert.match(
    changed('api_transit_subnet=10.217.11.0/28', 'api_transit_subnet=10.217.12.0/28').join('\n'),
    /api_transit_subnet/u,
  );
  assert.match(
    changed('api_transit_gateway=10.217.11.1', 'api_transit_gateway=10.217.11.2').join('\n'),
    /api_transit_gateway/u,
  );
  assert.match(changed('api_transit_range=10.217.11.8/29', '').join('\n'), /api_transit_range/u);
  // Docker 기본 주소 pool·AWS 기본 VPC(default VPC·Lightsail VPC)와 겹치는 대역은 계약 값이어도 거부한다.
  for (const subnet of ['172.31.0.0/28', '172.26.4.0/28', '192.168.10.0/28', '172.16.0.0/12']) {
    assert.match(
      transitSubnetProblems(lib, { ...API_TRANSIT, subnet }).join('\n'),
      /overlaps/u,
      subnet,
    );
  }
  assert.match(
    transitSubnetProblems(lib, API_TRANSIT, { ...WEB_TRANSIT, subnet: '10.217.11.0/28' }).join(
      '\n',
    ),
    /overlaps/u,
  );
});

test('the fragments use host absolute paths only and only the web fragment names the project', () => {
  const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
  const fragments = {
    web: read('infra/deploy/user/compose.yml'),
    api: read('infra/deploy/user/api/compose.yml'),
  };
  assert.deepEqual(fragmentTextProblems(fragments), []);
  const cases = [
    [{ api: `name: dormduri-web\n${fragments.api}` }, /api fragment: has a top-level name/u],
    [
      { web: fragments.web.replace('name: dormduri-web', 'name: dormduri-user') },
      /web fragment: name/u,
    ],
    [
      {
        api: fragments.api.replace(
          'source: ${API_SECRET_RELEASE_DIR',
          'source: ./secrets${API_SECRET_RELEASE_DIR',
        ),
      },
      /api fragment: has a relative path/u,
    ],
    [
      { web: fragments.web.replace('      - /opt/dormduri/tls:', '      - ../tls:') },
      /web fragment: has a relative path/u,
    ],
    [
      { api: `${fragments.api}\n    env_file: /opt/dormduri/api.env\n` },
      /api fragment: uses a file path key/u,
    ],
  ];
  for (const [change, expected] of cases) {
    const problems = fragmentTextProblems({ ...fragments, ...change });
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
});

test('the API environment is the Lightsail example and the runtime example keys it follows, without secrets', () => {
  const environment = apiEnvironmentFromExamples(repoRoot);
  const contract = JSON.parse(
    readFileSync(resolve(repoRoot, 'infra/deploy/api/secret-mount.contract.json'), 'utf8'),
  );
  for (const key of contract.requiredFiles) assert.equal(key in environment, false, key);
  assert.equal(environment.SECRET_SOURCE, 'mounted-files');
  assert.equal(environment.SECRET_MOUNT_DIRECTORY, '/run/secrets/dormduri-api');
  assert.equal(environment.DATABASE_POOL_MAX, '7');
  assert.equal(environment.HTTP_TRUST_PROXY_HOPS, '0');
  assert.equal(environment.SES_CONFIGURATION_SET, 'dormduri-production');
  assert.equal('API_SECRET_HOST_CURRENT' in environment, false);
  assert.equal('SECRET_NAME_PREFIX' in environment, false);
  // Keys only the runtime example has (the Lightsail example follows it for the rest).
  assert.equal(environment.AUTH_MAIL_DISPATCHER_ENABLED, 'true');
});

function rehearsalOf(production) {
  const rehearsal = structuredClone(production);
  rehearsal.name = 'dormduri-user-host-rehearsal';
  rehearsal.networks[WEB_TRANSIT.key].name = `dormduri-user-host-rehearsal_${WEB_TRANSIT.key}`;
  rehearsal.networks[API_TRANSIT.key] = {
    name: `dormduri-user-host-rehearsal_${API_TRANSIT.key}`,
    ipam: {},
  };
  rehearsal.services.web.build = { context: '/repo', dockerfile: 'infra/deploy/web/Dockerfile' };
  rehearsal.services.ingress.build = { context: '/repo/infra/deploy/user/ingress' };
  rehearsal.services.ingress.ports = [
    { target: 8080, published: '8180', host_ip: '127.0.0.1', protocol: 'tcp' },
    { target: 8443, published: '8543', host_ip: '127.0.0.1', protocol: 'tcp' },
  ];
  for (const volume of rehearsal.services.ingress.volumes)
    volume.source = `/repo/.artifacts${volume.target}`;
  return rehearsal;
}

test('the rehearsal may change only the build source, loopback ports, host path sources and the API transit owner', () => {
  const production = { name: 'dormduri-web', ...validConfig() };
  assert.deepEqual(rehearsalDifferenceProblems(production, rehearsalOf(production)), []);
  const cases = [
    [
      (r) => (r.services.web.environment.WEB_APP_URL = 'http://localhost'),
      /at \.services\.web\.environment\.WEB_APP_URL/u,
    ],
    [(r) => (r.services.web.read_only = false), /at \.services\.web\.read_only/u],
    [
      (r) => (r.services.ingress.volumes[0].target = '/srv'),
      /at \.services\.ingress\.volumes\[0\]\.target/u,
    ],
    [
      (r) => (r.services.ingress.volumes[1].read_only = false),
      /at \.services\.ingress\.volumes\[1\]\.read_only/u,
    ],
    [(r) => delete r.services.ingress.ports[0].host_ip, /publishes ingress 8080 beyond loopback/u],
    [
      (r) => (r.services.web.deploy.resources.limits.memory = '536870912'),
      /\.services\.web\.deploy\.resources\.limits\.memory/u,
    ],
    // The Web transit subnet and addresses stay: the private listener binds the ingress address.
    [
      (r) => (r.networks[WEB_TRANSIT.key].ipam.config[0].subnet = '10.99.0.0/28'),
      /at \.networks\.web-transit\.ipam\.config\[0\]\.subnet/u,
    ],
    [
      (r) => (r.services.ingress.networks[WEB_TRANSIT.key].ipv4_address = '10.217.10.4'),
      /at \.services\.ingress\.networks\.web-transit\.ipv4_address/u,
    ],
  ];
  for (const [change, expected] of cases) {
    const rehearsal = rehearsalOf(production);
    change(rehearsal);
    const problems = rehearsalDifferenceProblems(production, rehearsal);
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
});
