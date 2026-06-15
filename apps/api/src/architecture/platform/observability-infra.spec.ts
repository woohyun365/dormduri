import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const observabilityRoot = join(repoRoot, 'infra/observability');
const dashboardsRoot = join(observabilityRoot, 'grafana/dashboards');

const requiredFiles = [
  'docker-compose.observability.yml',
  '.env.observability.example',
  'prometheus/prometheus.yml',
  'prometheus/render-prometheus-config.sh',
  'prometheus/rules/api-alerts.yml',
  'prometheus/secrets/api-metrics-bearer-token.example',
  'grafana/provisioning/datasources/datasources.yml',
  'grafana/provisioning/dashboards/dashboards.yml',
  'grafana/dashboards/api-overview.json',
  'grafana/dashboards/realtime-auth-retention.json',
  'loki/loki.yml',
  'alloy/config.alloy',
  'README.md',
];

const requiredMetricNames = [
  'api_http_requests_total',
  'api_http_request_duration_seconds',
  'api_http_request_in_flight',
  'api_exceptions_total',
  'api_chat_realtime_connected_sockets',
  'api_realtime_dispatch_batches_total',
  'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds',
  'api_chat_realtime_rejections_total',
  'api_auth_cleanup_deleted_total',
  'api_auth_cleanup_lag_seconds',
  'api_retention_backlog_total',
  'api_retention_sweep_duration_seconds',
  'api_prisma_pool_connections',
  'api_prisma_transaction_retries_total',
];

const forbiddenLabelNames = [
  'actorHash',
  'authorization',
  'body',
  'cookie',
  'correlationId',
  'email',
  'ip',
  'messageId',
  'params',
  'password',
  'path',
  'payload',
  'query',
  'rawPath',
  'requestBody',
  'requestId',
  'sessionId',
  'threadId',
  'token',
  'userId',
];

function readInfraFile(relativePath: string): string {
  return readFileSync(join(observabilityRoot, relativePath), 'utf8');
}

function readDashboardFiles(): Array<{ path: string; source: string; parsed: unknown }> {
  return readdirSync(dashboardsRoot)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const source = readFileSync(join(dashboardsRoot, name), 'utf8');
      return { path: `grafana/dashboards/${name}`, source, parsed: JSON.parse(source) as unknown };
    });
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function stripCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#') && !line.trimStart().startsWith('//'))
    .join('\n');
}

describe('observability infra', () => {
  it('keeps repo-native observability stack files in the expected locations', () => {
    const missingFiles = requiredFiles.filter(
      (relativePath) => !existsSync(join(observabilityRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);
  });

  it('keeps observability services local/private by default', () => {
    const compose = readInfraFile('docker-compose.observability.yml');

    expect(compose).toContain('prometheus:');
    expect(compose).toContain('grafana:');
    expect(compose).toContain('loki:');
    expect(compose).toContain('alloy:');
    expect(compose).toContain('127.0.0.1:${PROMETHEUS_PORT:-9090}:9090');
    expect(compose).toContain('127.0.0.1:${GRAFANA_PORT:-3001}:3000');
    expect(compose).toContain('127.0.0.1:${LOKI_PORT:-3100}:3100');
    expect(compose).toContain('GF_AUTH_ANONYMOUS_ENABLED');
    expect(compose).toContain("'false'");
    expect(compose).not.toMatch(/-\s+['"]?0\.0\.0\.0:/);
  });

  it('configures Prometheus to scrape the API internal metrics endpoint with a token file', () => {
    const compose = readInfraFile('docker-compose.observability.yml');
    const prometheusConfig = readInfraFile('prometheus/prometheus.yml');
    const renderScript = readInfraFile('prometheus/render-prometheus-config.sh');
    const rules = readInfraFile('prometheus/rules/api-alerts.yml');

    expect(compose).toContain('entrypoint:');
    expect(compose).toContain('/bin/sh');
    expect(compose).toContain('/etc/prometheus/render-prometheus-config.sh');
    expect(prometheusConfig).toContain('job_name: api');
    expect(prometheusConfig).toContain('metrics_path: /internal/metrics');
    expect(prometheusConfig).toContain(
      'credentials_file: /etc/prometheus/secrets/api-metrics-bearer-token',
    );
    expect(prometheusConfig).toContain('__API_METRICS_TARGET__');
    expect(renderScript).toContain('API_METRICS_TARGET');
    expect(renderScript).toContain('/bin/prometheus');
    expect(rules).toContain('ApiHigh5xxRate');
    expect(rules).toContain('ApiP95LatencyHigh');
    expect(rules).toContain('RealtimeOutboxLagHigh');
    expect(rules).toContain('PrismaPoolWaitingHigh');
    expect(rules).toContain('RetentionReviewBacklogHigh');
    expect(rules).toContain('AuthCleanupLagHigh');
  });

  it('provisions Grafana Prometheus/Loki datasources and dashboards from files', () => {
    const datasources = readInfraFile('grafana/provisioning/datasources/datasources.yml');
    const dashboardProvider = readInfraFile('grafana/provisioning/dashboards/dashboards.yml');
    const dashboardFiles = readDashboardFiles();

    expect(datasources).toContain('uid: prometheus');
    expect(datasources).toContain('type: prometheus');
    expect(datasources).toContain('uid: loki');
    expect(datasources).toContain('type: loki');
    expect(dashboardProvider).toContain('/var/lib/grafana/dashboards');
    expect(dashboardFiles.map((file) => file.path)).toEqual([
      'grafana/dashboards/api-overview.json',
      'grafana/dashboards/realtime-auth-retention.json',
    ]);

    for (const dashboard of dashboardFiles) {
      const strings = collectStrings(dashboard.parsed);
      expect(strings).toContain('prometheus');
      expect(strings.some((value) => value.includes('api_'))).toBe(true);
    }
  });

  it('keeps dashboard queries aligned with Phase 2/3 API metric names', () => {
    const dashboardQueryText = readDashboardFiles()
      .flatMap((dashboard) => collectStrings(dashboard.parsed))
      .join('\n');

    const missingMetrics = requiredMetricNames.filter(
      (metricName) => !dashboardQueryText.includes(metricName),
    );

    expect(missingMetrics).toEqual([]);
  });

  it('keeps Loki/Alloy label configuration low-cardinality', () => {
    const loki = readInfraFile('loki/loki.yml');
    const alloy = stripCommentLines(readInfraFile('alloy/config.alloy'));

    expect(loki).toContain('retention_period: 720h');
    expect(alloy).toContain('loki.source.docker');
    expect(alloy).toContain('loki.process');
    expect(alloy).toContain('stage.label_keep');
    expect(alloy).toContain('level = "level",');
    expect(alloy).toContain('values = ["service", "env", "container", "level"]');

    for (const forbiddenLabelName of forbiddenLabelNames) {
      const labelAssignment = new RegExp(`\\b${forbiddenLabelName}\\s*=`);
      expect(alloy).not.toMatch(labelAssignment);
    }
  });

  it('does not use forbidden high-cardinality label selectors in dashboards or Prometheus rules', () => {
    const configText = [
      readInfraFile('prometheus/prometheus.yml'),
      readInfraFile('prometheus/rules/api-alerts.yml'),
      ...readDashboardFiles().map((dashboard) => dashboard.source),
    ].join('\n');

    for (const forbiddenLabelName of forbiddenLabelNames) {
      const labelSelector = new RegExp(`[,{]\\s*${forbiddenLabelName}\\s*=`, 'u');
      expect(configText).not.toMatch(labelSelector);
    }
  });
});
