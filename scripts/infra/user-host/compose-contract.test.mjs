import assert from 'node:assert/strict';
import test from 'node:test';

import { checkUserHostCompose } from './compose-contract.mjs';

// The shape `docker compose config --format json` renders for infra/deploy/user/compose.yml. validate-compose runs the
// same check on the real file; this fixture proves the check rejects each weakened boundary.
function hardened(memory, pids) {
  return {
    read_only: true,
    cap_drop: ['ALL'],
    security_opt: ['no-new-privileges:true'],
    restart: 'unless-stopped',
    networks: { web: null },
    logging: { driver: 'json-file', options: { 'max-file': '3', 'max-size': '10m' } },
    deploy: { resources: { limits: { memory: String(memory), pids } } },
  };
}

function validConfig() {
  return {
    services: {
      web: {
        ...hardened(335544320, 256),
        tmpfs: ['/tmp:size=64m,mode=1777', '/app/apps/web/.next/cache:size=128m,mode=1777'],
        environment: {
          NODE_ENV: 'production',
          WEB_APP_URL: 'https://dormduri.com',
          API_URL: 'http://ingress:8081',
        },
        expose: ['3000'],
      },
      ingress: {
        ...hardened(100663296, 128),
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

function withChange(change) {
  const config = validConfig();
  change(config.services);
  return checkUserHostCompose(config);
}

test('the hardened Web stage compose shape passes', () => {
  assert.deepEqual(checkUserHostCompose(validConfig()), []);
});

test('each weakened boundary is rejected', () => {
  const cases = [
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
    [(s) => (s.web.networks = { web: null, default: null }), /web: not only on the web network/u],
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
  ];
  for (const [change, expected] of cases) {
    const problems = withChange(change);
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
});
