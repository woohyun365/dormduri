import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectStrings,
  observabilityRoot,
  readDashboardFiles,
  readInfraFile,
  repoRoot,
  stripCommentLines,
} from './observability-test.support.js';

const requiredFiles = [
  'compose.base.yml',
  'compose.resources.yml',
  'compose.production.yml',
  'production-operations.json',
  '.env.observability.example',
  'fixtures/web-upstream.mjs',
  'prometheus/prometheus.yml',
  'prometheus/render-prometheus-config.sh',
  'alertmanager/render-alertmanager-config.sh',
  'alertmanager/alertmanager.yml.template',
  'grafana/provisioning/datasources/datasources.yml',
  'grafana/provisioning/dashboards/dashboards.yml',
  'grafana/dashboards/api-overview.json',
  'grafana/dashboards/realtime-auth-retention.json',
  'grafana/dashboards/web-bff-reliability.json',
  'loki/loki.yml',
  'loki/rules/web-bff-alerts.yml',
  'alloy/config.alloy',
];

describe('observability stack', () => {
  it('keeps the private repo-native stack and file-provisioned dashboards', () => {
    expect(requiredFiles.filter((path) => !existsSync(join(observabilityRoot, path)))).toEqual([]);
    expect(
      [
        'infra/rehearsal/compose.observability.yml',
        'infra/rehearsal/compose.web.yml',
        'infra/rehearsal/compose.web.fixture.yml',
      ].filter((path) => !existsSync(join(repoRoot, path))),
    ).toEqual([]);
    const compose = readInfraFile('compose.base.yml');
    expect(compose).toContain('127.0.0.1:${PROMETHEUS_PORT:-9090}:9090');
    expect(compose).toContain('127.0.0.1:${GRAFANA_PORT:-3001}:3000');
    expect(compose).not.toMatch(/-\s+['"]?0\.0\.0\.0:/);

    const datasources = readInfraFile('grafana/provisioning/datasources/datasources.yml');
    expect(datasources).toContain('uid: prometheus');
    expect(datasources).toContain('uid: loki');
    expect(readDashboardFiles().map((file) => file.path)).toEqual([
      'grafana/dashboards/api-overview.json',
      'grafana/dashboards/realtime-auth-retention.json',
      'grafana/dashboards/web-bff-reliability.json',
    ]);
  });

  it('keeps log labels low-cardinality', () => {
    const alloy = stripCommentLines(readInfraFile('alloy/config.alloy'));
    expect(readInfraFile('loki/loki.yml')).toContain('retention_period: 720h');
    expect(alloy).toContain('values = ["service", "env", "container", "level"]');
    const forbidden = ['email', 'ip', 'requestId', 'sessionId', 'threadId', 'token', 'userId'];
    for (const label of forbidden) expect(alloy).not.toMatch(new RegExp(`\\b${label}\\s*=`));
    expect(alloy).toContain('regex         = "api|nginx|web"');
    expect(alloy).toContain('action        = "keep"');
    expect(alloy).toContain('sys.env("OBSERVABILITY_ENV")');
  });

  it('keeps dashboards backed by API metrics', () => {
    const text = readDashboardFiles()
      .flatMap((file) => collectStrings(file.parsed))
      .join('\n');
    for (const metric of [
      'api_http_requests_total',
      'api_http_request_duration_seconds',
      'api_auth_cleanup_failures_total',
      'api_retention_backlog_total',
      'api_prisma_pool_connections',
    ]) {
      expect(text).toContain(metric);
    }
  });

  it('keeps the Web BFF dashboard on bounded outcomes and latency percentiles', () => {
    const dashboard = readInfraFile('grafana/dashboards/web-bff-reliability.json');
    expect(dashboard).toContain('web_bff_request_completed');
    expect(dashboard).toContain('count_over_time');
    expect(dashboard).toContain('quantile_over_time(0.50');
    expect(dashboard).toContain('quantile_over_time(0.95');
    expect(dashboard).toContain('quantile_over_time(0.99');
  });

  it('keeps the Web local rehearsal on a production standalone image and private ports', () => {
    const compose = readFileSync(join(repoRoot, 'infra/rehearsal/compose.web.yml'), 'utf8');
    const fixtureCompose = readFileSync(
      join(repoRoot, 'infra/rehearsal/compose.web.fixture.yml'),
      'utf8',
    );
    const dockerfile = readFileSync(join(repoRoot, 'infra/deploy/web/Dockerfile'), 'utf8');
    const runner = readFileSync(
      join(repoRoot, 'scripts/observability/web-local-rehearsal.mjs'),
      'utf8',
    );

    expect(compose).toContain('dockerfile: infra/deploy/web/Dockerfile');
    expect(compose).toContain('127.0.0.1:${WEB_REHEARSAL_PORT:-3300}:3000');
    expect(compose).toContain("WEB_BFF_OPERATIONAL_LOGGING_ENABLED: '1'");
    expect(compose).not.toContain('web-upstream:');
    expect(fixtureCompose).toContain('web-upstream:');
    expect(fixtureCompose).toContain('http://web-upstream:4100');
    expect(dockerfile).toContain('.next/standalone');
    expect(dockerfile).toContain('apps/web/server.js');
    expect(runner).toContain("context === 'orbstack'");
    expect(runner).toContain("service: 'loki'");
    expect(runner).toContain("service: 'prometheus'");
    expect(runner).toContain("service: 'grafana'");
    expect(runner).toContain('knu-web-bff-reliability');
  });
});
