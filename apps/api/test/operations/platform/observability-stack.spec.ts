import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectStrings,
  observabilityRoot,
  readDashboardFiles,
  readInfraFile,
  stripCommentLines,
} from './observability-test.support.js';

const requiredFiles = [
  'docker-compose.observability.yml',
  '.env.observability.example',
  'prometheus/prometheus.yml',
  'prometheus/render-prometheus-config.sh',
  'alertmanager/render-alertmanager-config.sh',
  'alertmanager/alertmanager.yml.template',
  'grafana/provisioning/datasources/datasources.yml',
  'grafana/provisioning/dashboards/dashboards.yml',
  'grafana/dashboards/api-overview.json',
  'grafana/dashboards/realtime-auth-retention.json',
  'loki/loki.yml',
  'alloy/config.alloy',
];

describe('observability stack', () => {
  it('keeps the private repo-native stack and file-provisioned dashboards', () => {
    expect(requiredFiles.filter((path) => !existsSync(join(observabilityRoot, path)))).toEqual([]);
    const compose = readInfraFile('docker-compose.observability.yml');
    expect(compose).toContain('127.0.0.1:${PROMETHEUS_PORT:-9090}:9090');
    expect(compose).toContain('127.0.0.1:${GRAFANA_PORT:-3001}:3000');
    expect(compose).not.toMatch(/-\s+['"]?0\.0\.0\.0:/);

    const datasources = readInfraFile('grafana/provisioning/datasources/datasources.yml');
    expect(datasources).toContain('uid: prometheus');
    expect(datasources).toContain('uid: loki');
    expect(readDashboardFiles().map((file) => file.path)).toEqual([
      'grafana/dashboards/api-overview.json',
      'grafana/dashboards/realtime-auth-retention.json',
    ]);
  });

  it('keeps log labels low-cardinality', () => {
    const alloy = stripCommentLines(readInfraFile('alloy/config.alloy'));
    expect(readInfraFile('loki/loki.yml')).toContain('retention_period: 720h');
    expect(alloy).toContain('values = ["service", "env", "container", "level"]');
    const forbidden = ['email', 'ip', 'requestId', 'sessionId', 'threadId', 'token', 'userId'];
    for (const label of forbidden) expect(alloy).not.toMatch(new RegExp(`\\b${label}\\s*=`));
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
});
