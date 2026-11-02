import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const deployRoot = join(repoRoot, 'infra/deploy');

const requiredFiles = [
  'README.md',
  '.env.api.example',
  '.env.api.lightsail.example',
  '.env.api.migration.example',
  '.env.compose.example',
  'compose.api.yml',
  'api/Dockerfile',
  'api/env.manifest.json',
  'api/secret-mount.contract.json',
  'api/entrypoint.sh',
  'api/healthcheck.sh',
  'scripts/materialize-api-secret-bundle.sh',
  'scripts/verify-api-secret-bundle.sh',
  'scripts/install-api-secret-bundle.sh',
  'nginx/nginx.conf',
  'nginx/conf.d/api.conf',
  'nginx/examples/api.tls.conf',
  'nginx/snippets/internal-metrics-allowlist.conf',
  'nginx/snippets/proxy-common.conf',
];

const ingressPolicyEnvNames = [
  'HTTP_CORS_ALLOWED_ORIGINS',
  'CHAT_REALTIME_ALLOWED_ORIGINS',
  'CHAT_REALTIME_TRUST_PROXY',
];

const nginxTlsExampleKnobNames = [
  'NGINX_SERVER_NAME',
  'NGINX_HTTPS_PORT',
  'NGINX_TLS_CERT_PATH',
  'NGINX_TLS_KEY_PATH',
];

function readDeployFile(relativePath: string): string {
  return readFileSync(join(deployRoot, relativePath), 'utf8');
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function exactNginxLocations(source: string): string[] {
  return [...source.matchAll(/location\s+=\s+([^\s{]+)\s*\{/gu)]
    .map((match) => match[1])
    .filter((path): path is string => path !== undefined)
    .sort();
}

describe('deployment infra', () => {
  it('keeps BE deploy files in the expected infra/deploy locations', () => {
    const missingFiles = requiredFiles.filter(
      (relativePath) => !existsSync(join(deployRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);
  });

  it('defines api and nginx services without owning a production database service', () => {
    const compose = readDeployFile('compose.api.yml');

    expect(compose).toContain('api:');
    expect(compose).toContain('nginx:');
    expect(compose).toContain('dockerfile: infra/deploy/api/Dockerfile');
    expect(compose).toContain('context: ../..');
    expect(compose).toContain('expose:');
    expect(compose).toContain("- '4000'");
    expect(compose).toContain('condition: service_healthy');
    expect(compose).not.toMatch(/^\s+(postgres|database|db):\s*$/mu);
    expect(compose).not.toContain('POSTGRES_PASSWORD');
  });

  it('keeps observability network outside the production-neutral base', () => {
    const compose = readDeployFile('compose.api.yml');
    const override = readRepoFile('infra/rehearsal/compose.api.runtime.yml');
    const stress = readRepoFile('apps/api/test/stress/docker/compose.stress.yml');

    expect(compose).not.toContain('external: true');
    expect(compose).not.toContain('AUTH_THROTTLE_LIMIT');
    expect(override).toContain('observability:');
    expect(override).toContain('external: true');
    expect(override).toContain('dormduri-observability');
    expect(override).not.toContain('AUTH_THROTTLE_LIMIT');
    expect(stress).toContain('AUTH_THROTTLE_LIMIT');
  });

  it('keeps production TypeScript build free of test support harness files', () => {
    const tsconfigBuild = readRepoFile('apps/api/tsconfig.build.json');

    expect(tsconfigBuild).toContain('**/test-support/**');
  });

  it('builds the API image from the workspace root without copying local secret surfaces', () => {
    const dockerfile = readDeployFile('api/Dockerfile');
    const dockerignore = readRepoFile('.dockerignore');

    expect(dockerfile).toContain('ARG NODE_IMAGE=node:');
    expect(dockerfile).toContain('FROM ${NODE_IMAGE} AS base');
    expect(dockerfile).toContain('FROM ${NODE_IMAGE} AS runtime');
    // scripts/ci/contracts/package-manager-reference-policy.test.mjs owns how every image installs pnpm.
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).toContain(
      'pnpm --dir apps/api exec tsc -p ../../packages/shared/tsconfig.json',
    );
    expect(dockerfile).toContain('test -f apps/api/src/generated/prisma/client.ts');
    expect(dockerfile).toContain('test -f apps/api/src/generated/prisma/sql.ts');
    expect(dockerfile).toContain('pnpm --dir apps/api exec nest build');
    expect(dockerfile).toContain('node", "dist/main.js"');
    expect(dockerfile).not.toContain('prisma db push');
    expect(dockerfile).not.toContain('prisma migrate');

    expect(dockerignore).toContain('.omx');
    expect(dockerignore).toContain('.env.*');
    expect(dockerignore).toContain('apps/api/test/stress/reports/.tmp-*');
    expect(dockerignore).toContain('infra/observability/prometheus/secrets/*.local');
  });

  it('checks generated runtime requirements without echoing secret values', () => {
    const entrypoint = readDeployFile('api/entrypoint.sh');
    const dockerfile = readDeployFile('api/Dockerfile');

    expect(entrypoint).toContain('env.manifest.json');
    expect(entrypoint).toContain('containerStartupRequired');
    expect(entrypoint).toContain('missing required env: $name');
    expect(entrypoint).not.toContain('echo "$value"');
    expect(entrypoint).not.toContain('required_env="DATABASE_URL');
    expect(dockerfile).toContain('infra/deploy/api/env.manifest.json');
  });

  it('keeps release smoke aligned with the bounded public health schema', () => {
    const releaseSmoke = readDeployFile('scripts/api-release-smoke.sh');

    expect(releaseSmoke).toContain('assert_health_response');
    expect(releaseSmoke).toContain('"status"');
    expect(releaseSmoke).toContain('"timestamp"');
    expect(releaseSmoke).toContain('"uptimeSeconds"');
    expect(releaseSmoke).toContain('"failureCodes"');
    for (const forbiddenField of [
      'checks',
      'details',
      'secretSource',
      'secretOrigin',
      'mountPath',
      'rawError',
    ]) {
      expect(releaseSmoke).toContain(forbiddenField);
    }
  });

  it('documents HTTP REST and realtime ingress policy env names in the deploy template', () => {
    const envExample = readDeployFile('.env.api.example');

    for (const envName of ingressPolicyEnvNames) {
      expect(envExample).toContain(`${envName}=`);
    }
  });

  it('documents direct nginx TLS example knobs without loading them in the base compose', () => {
    const envExample = readDeployFile('.env.compose.example');
    const compose = readDeployFile('compose.api.yml');

    for (const envName of nginxTlsExampleKnobNames) {
      expect(envExample).toContain(`${envName}=`);
    }

    expect(compose).toContain('${NGINX_HTTP_BIND:-127.0.0.1}');
    expect(compose).toContain('${NGINX_HTTP_PORT:-8080}:80');
    expect(compose).not.toContain('${NGINX_HTTPS_PORT');
    expect(compose).not.toContain('NGINX_TLS_CERT_PATH');
  });

  it('proxies public API/auth/health/socket paths and keeps metrics private', () => {
    const apiConf = readDeployFile('nginx/conf.d/api.conf');
    const allowlist = readDeployFile('nginx/snippets/internal-metrics-allowlist.conf');
    const proxyCommon = readDeployFile('nginx/snippets/proxy-common.conf');
    const healthcheck = readDeployFile('api/healthcheck.sh');

    expect(apiConf).toContain('location /api/');
    expect(apiConf).toContain('location /auth/');
    expect(apiConf).toContain('location /socket.io/');
    expect(apiConf).toContain('location = /health');
    expect(apiConf).toContain('location = /health/live');
    expect(apiConf).toContain('location = /health/ready');
    expect(apiConf).toContain('location = /internal/metrics');
    expect(exactNginxLocations(apiConf)).toEqual([
      '/health',
      '/health/live',
      '/health/ready',
      '/internal/metrics',
    ]);
    expect(apiConf).not.toContain('/health/auth');
    expect(apiConf).not.toContain('/health/realtime');
    expect(apiConf).toContain('proxy_set_header Upgrade $http_upgrade');
    expect(apiConf).toContain('proxy_set_header Connection $connection_upgrade');
    expect(apiConf).toContain('proxy_set_header Authorization $http_authorization');
    expect(apiConf).toContain('include /etc/nginx/snippets/internal-metrics-allowlist.conf');
    expect(allowlist).toContain('deny all');
    expect(proxyCommon).toContain('X-Forwarded-For');
    expect(proxyCommon).toContain('X-Request-Id');
    expect(healthcheck).toContain('/health/ready');
    expect(healthcheck).not.toContain('/health/auth');
    expect(healthcheck).not.toContain('/health/realtime');
  });

  it('keeps the TLS/domain example outside the active nginx conf.d mount', () => {
    const compose = readDeployFile('compose.api.yml');
    const tlsExample = readDeployFile('nginx/examples/api.tls.conf');

    expect(compose).toContain('./nginx/conf.d:/etc/nginx/conf.d:ro');
    expect(compose).not.toContain('./nginx/examples:/etc/nginx/conf.d');
    expect(tlsExample).toContain('listen 443 ssl');
    expect(tlsExample).toContain('http2 on');
    expect(tlsExample).toContain('return 301 https://$host$request_uri');
    expect(tlsExample).toContain(
      'ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem',
    );
    expect(tlsExample).toContain('location /socket.io/');
    expect(tlsExample).toContain('proxy_set_header Upgrade $http_upgrade');
    expect(tlsExample).toContain('location = /internal/metrics');
    expect(tlsExample).toContain('include /etc/nginx/snippets/internal-metrics-allowlist.conf');
  });
});
