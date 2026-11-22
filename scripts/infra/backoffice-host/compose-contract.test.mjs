import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOY_HOST_READS,
  ALLOY_SECRET_TARGET,
  API_SECRET_TARGET,
  BACKOFFICE_API_URL,
  BACKOFFICE_MEMORY_LIMITS,
  BACKOFFICE_NETWORKS,
  BACKOFFICE_RENDER_ENVIRONMENT as ENV,
  checkBackofficeCompose,
  readSecretContract,
} from './compose-contract.mjs';

const repoRoot = process.cwd();
const contract = readSecretContract(repoRoot);
const ALLOY = `grafana/alloy:v1.21.3@sha256:${'a'.repeat(64)}`;

// The shape `docker compose --profile bootstrap config --format json` renders for infra/deploy/backoffice/compose.yml.
// validate-compose runs the same checks on the real file; these fixtures prove each check rejects a weakened boundary.
function service(name, networks, extra = {}) {
  return {
    read_only: true,
    init: true,
    cap_drop: ['ALL'],
    security_opt: ['no-new-privileges:true'],
    restart: 'unless-stopped',
    tmpfs: ['/tmp:size=16m,mode=1777'],
    logging: { driver: 'json-file', options: { 'max-file': '3', 'max-size': '10m' } },
    networks: Object.fromEntries(networks.map((key) => [key, {}])),
    deploy: {
      resources: { limits: { memory: String(BACKOFFICE_MEMORY_LIMITS[name]), pids: 128 } },
    },
    ...extra,
  };
}
const fileMounts = (root, target, files) =>
  files.map((file) => ({
    type: 'bind',
    source: `${root}/${file}`,
    target: `${target}/${file}`,
    read_only: true,
    bind: { create_host_path: false },
  }));

function validConfig() {
  const apiSecrets = fileMounts(
    ENV.BACKOFFICE_SECRET_RELEASE_DIR,
    API_SECRET_TARGET,
    contract.apiFiles,
  );
  return {
    name: 'dormduri-backoffice',
    services: {
      'backoffice-ingress': service(
        'backoffice-ingress',
        ['backoffice-publish', 'backoffice-front'],
        {
          image: ENV.BACKOFFICE_INGRESS_IMAGE,
          ports: [
            {
              mode: 'ingress',
              host_ip: '127.0.0.1',
              target: 8080,
              published: '4300',
              protocol: 'tcp',
            },
          ],
          healthcheck: {
            test: [
              'CMD',
              'wget',
              '-q',
              '-O',
              '/dev/null',
              'http://127.0.0.1:8081/__ingress/health',
            ],
          },
        },
      ),
      'backoffice-web': service('backoffice-web', ['backoffice-front', 'backoffice-app'], {
        image: ENV.BACKOFFICE_WEB_IMAGE,
        environment: { NODE_ENV: 'production', BACKOFFICE_API_URL },
      }),
      'backoffice-api': service('backoffice-api', ['backoffice-app', 'backoffice-egress'], {
        image: ENV.BACKOFFICE_API_IMAGE,
        environment: { NODE_ENV: 'production' },
        volumes: apiSecrets,
      }),
      'bootstrap-owner': service('bootstrap-owner', ['backoffice-egress'], {
        image: ENV.BACKOFFICE_API_IMAGE,
        profiles: ['bootstrap'],
        entrypoint: ['./entrypoint.sh', 'node', 'dist/cli/bootstrap-owner.js'],
        restart: 'no',
        logging: { driver: 'none' },
        volumes: apiSecrets,
      }),
      alloy: service('alloy', ['backoffice-front', 'backoffice-app', 'backoffice-egress'], {
        image: ALLOY,
        user: '0:473',
        deploy: {
          resources: {
            limits: { cpus: 0.1, memory: String(BACKOFFICE_MEMORY_LIMITS.alloy), pids: 128 },
          },
        },
        volumes: [
          {
            type: 'bind',
            source: ENV.BACKOFFICE_ALLOY_CONFIG_DIR,
            target: '/etc/alloy',
            read_only: true,
            bind: { create_host_path: false },
          },
          ...fileMounts(
            ENV.BACKOFFICE_OBSERVABILITY_SECRET_DIR,
            ALLOY_SECRET_TARGET,
            contract.observabilityFiles,
          ),
          ...Object.entries(ALLOY_HOST_READS).map(([source, target]) => ({
            type: 'bind',
            source,
            target,
            read_only: true,
          })),
          { type: 'volume', source: 'alloy-data', target: '/var/lib/alloy/data' },
        ],
      }),
    },
    networks: Object.fromEntries(
      Object.entries(BACKOFFICE_NETWORKS).map(([key, { subnet, gateway, internal }]) => [
        key,
        {
          name: `dormduri-backoffice_${key}`,
          driver: 'bridge',
          ipam: { config: [{ subnet, gateway }] },
          ...(internal ? { internal: true } : {}),
        },
      ]),
    ),
  };
}
const check = (config) =>
  checkBackofficeCompose(config, { contract, pins: { alloy: ALLOY }, environment: ENV });
const weakened = (mutate) => {
  const config = validConfig();
  mutate(config);
  return check(config);
};

test('the hardened backoffice compose shape passes', () => {
  assert.deepEqual(check(validConfig()), []);
});

// D-BF2: host publish는 admin ingress의 127.0.0.1:4300 한 줄뿐이다(같은 계정 Lightsail resource는 사설 IP로 닿는다).
test('a publish beyond the one loopback port is rejected', () => {
  const ingressPorts = (config) => config.services['backoffice-ingress'].ports;
  const cases = {
    'all interfaces': (config) => (ingressPorts(config)[0].host_ip = '0.0.0.0'),
    'no host address': (config) => delete ingressPorts(config)[0].host_ip,
    'IPv6 any': (config) => (ingressPorts(config)[0].host_ip = '::'),
    'IPv6 loopback only': (config) => (ingressPorts(config)[0].host_ip = '::1'),
    'a second line': (config) =>
      ingressPorts(config).push({
        host_ip: '127.0.0.1',
        target: 8081,
        published: '4301',
        protocol: 'tcp',
      }),
    'another port': (config) => (ingressPorts(config)[0].published = '8080'),
    'the web port': (config) =>
      (config.services['backoffice-web'].ports = [
        { host_ip: '127.0.0.1', target: 3000, published: '3000', protocol: 'tcp' },
      ]),
    'the api port': (config) =>
      (config.services['backoffice-api'].ports = [
        { host_ip: '127.0.0.1', target: 4310, published: '4310', protocol: 'tcp' },
      ]),
    udp: (config) => (ingressPorts(config)[0].protocol = 'udp'),
    'host network': (config) => (config.services.alloy.network_mode = 'host'),
  };
  for (const [name, mutate] of Object.entries(cases)) {
    assert.ok(
      weakened(mutate).some((problem) =>
        /ports:|host network|shares a host namespace/u.test(problem),
      ),
      `${name} must be rejected`,
    );
  }
});

test('each weakened container boundary is rejected', () => {
  const cases = {
    'writable root': (config) => (config.services['backoffice-api'].read_only = false),
    'a kept capability': (config) => (config.services['backoffice-web'].cap_drop = []),
    'an added capability': (config) =>
      (config.services['backoffice-ingress'].cap_add = ['NET_ADMIN']),
    'no no-new-privileges': (config) => (config.services['backoffice-api'].security_opt = []),
    'seccomp off': (config) =>
      config.services['backoffice-api'].security_opt.push('seccomp=unconfined'),
    privileged: (config) => (config.services.alloy.privileged = true),
    'root API': (config) => (config.services['backoffice-api'].user = '0:0'),
    'no /tmp tmpfs': (config) => (config.services['backoffice-web'].tmpfs = []),
    'a different memory limit': (config) =>
      (config.services['backoffice-web'].deploy.resources.limits.memory = String(
        1024 * 1024 * 1024,
      )),
    'no pids limit': (config) =>
      delete config.services['backoffice-api'].deploy.resources.limits.pids,
    'no log rotation': (config) =>
      (config.services['backoffice-api'].logging = { driver: 'json-file' }),
    'a bootstrap log': (config) =>
      (config.services['bootstrap-owner'].logging = {
        driver: 'json-file',
        options: { 'max-size': '10m', 'max-file': '3' },
      }),
    'Web reaches out': (config) =>
      (config.services['backoffice-web'].networks['backoffice-egress'] = {}),
    'ingress on the app network': (config) =>
      (config.services['backoffice-ingress'].networks['backoffice-app'] = {}),
    'API socket': (config) =>
      config.services['backoffice-api'].volumes.push({
        type: 'bind',
        source: '/var/run/docker.sock',
        target: '/var/run/docker.sock',
        read_only: true,
      }),
    'Web host path': (config) =>
      (config.services['backoffice-web'].volumes = [
        { type: 'bind', source: '/opt', target: '/opt' },
      ]),
    'Web API URL': (config) =>
      (config.services['backoffice-web'].environment.BACKOFFICE_API_URL = 'http://localhost:4310'),
    'bootstrap without profile': (config) => delete config.services['bootstrap-owner'].profiles,
    'bootstrap with another image': (config) =>
      (config.services['bootstrap-owner'].image = ENV.BACKOFFICE_WEB_IMAGE),
    'API behind a profile': (config) => (config.services['backoffice-api'].profiles = ['x']),
    'a missing API secret': (config) => config.services['backoffice-api'].volumes.pop(),
    'an extra API mount': (config) =>
      config.services['backoffice-api'].volumes.push({
        type: 'bind',
        source: '/etc',
        target: '/host-etc',
        read_only: true,
      }),
    'a writable API secret': (config) =>
      (config.services['backoffice-api'].volumes[0].read_only = false),
    'an ingest secret in the API': (config) =>
      config.services['backoffice-api'].volumes.push(
        ...fileMounts(ENV.BACKOFFICE_SECRET_RELEASE_DIR, API_SECRET_TARGET, [
          'OBSERVABILITY_INGEST_TOKEN',
        ]),
      ),
    'Alloy writable socket': (config) =>
      (config.services.alloy.volumes.find(
        (volume) => volume.source === '/var/run/docker.sock',
      ).read_only = false),
    'Alloy another pin': (config) => (config.services.alloy.image = 'grafana/alloy:latest'),
    'Alloy extra mount': (config) =>
      config.services.alloy.volumes.push({
        type: 'bind',
        source: '/root',
        target: '/root',
        read_only: true,
      }),
    'Alloy without host reads': (config) =>
      (config.services.alloy.volumes = config.services.alloy.volumes.filter(
        (volume) => volume.source !== '/proc',
      )),
    'a sixth service': (config) => (config.services.extra = config.services['backoffice-web']),
  };
  for (const [name, mutate] of Object.entries(cases)) {
    assert.notDeepEqual(weakened(mutate), [], `${name} must be rejected`);
  }
});

test('each weakened network is rejected', () => {
  const cases = {
    'front not internal': (config) => delete config.networks['backoffice-front'].internal,
    'egress internal': (config) => (config.networks['backoffice-egress'].internal = true),
    'another subnet': (config) =>
      (config.networks['backoffice-app'].ipam.config[0].subnet = '10.217.30.0/28'),
    'Docker pool subnet': (config) =>
      (config.networks['backoffice-publish'].ipam.config[0].subnet = '172.20.0.0/28'),
    'external network': (config) => (config.networks['backoffice-egress'].external = true),
    'unprotected gateway mode': (config) =>
      (config.networks['backoffice-publish'].driver_opts = {
        'com.docker.network.bridge.gateway_mode_ipv4': 'nat-unprotected',
      }),
    'trusted host interfaces': (config) =>
      (config.networks['backoffice-publish'].driver_opts = {
        'com.docker.network.bridge.trusted_host_interfaces': 'eth0',
      }),
    'a fifth network': (config) => (config.networks.extra = { ipam: {} }),
  };
  for (const [name, mutate] of Object.entries(cases)) {
    assert.ok(
      weakened(mutate).some((problem) => problem.startsWith('networks:')),
      `${name} must be rejected`,
    );
  }
});

test('the fixed subnets avoid the Docker pools, the AWS default VPC ranges and the user host networks', () => {
  for (const { subnet } of Object.values(BACKOFFICE_NETWORKS)) {
    assert.match(subnet, /^10\.217\.2[0-9]\.0\/28$/u);
  }
});
