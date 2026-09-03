import { describe, expect, it } from 'vitest';
import { collectStrings, readDashboardFiles, readInfraFile } from './observability-test.support.js';

const forbiddenLabels = ['email', 'ip', 'requestId', 'sessionId', 'threadId', 'token', 'userId'];
const trackedPrometheusQueryMetricFamilies = [
  'api_auth_cleanup_batch_saturated',
  'api_auth_cleanup_deleted_total',
  'api_auth_cleanup_failures_total',
  'api_auth_login_attempts_total',
  'api_auth_login_password_verify_duration_seconds_bucket',
  'api_auth_login_password_verify_in_flight',
  'api_auth_mail_dispatch_total',
  'api_auth_mail_outbox_lag_seconds',
  'api_auth_sensitive_mutations_total',
  'api_auth_session_renewals_total',
  'api_auth_signup_final_admission_total',
  'api_auth_signup_password_hash_total',
  'api_chat_realtime_connected_sockets',
  'api_chat_realtime_rejections_total',
  'api_exceptions_total',
  'api_http_request_duration_seconds_bucket',
  'api_http_request_in_flight',
  'api_http_requests_total',
  'api_prisma_pool_connections',
  'api_prisma_transaction_retries_total',
  'api_realtime_dispatch_batches_total',
  'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds',
  'api_retention_backlog_total',
  'api_retention_sweep_duration_seconds_bucket',
  'process_resident_memory_bytes',
] as const;

function collectPrometheusQueryMetricFamilies(): string[] {
  const querySources = [
    readInfraFile('prometheus/rules/api-alerts.yml'),
    ...readDashboardFiles().flatMap((file) => collectStrings(file.parsed)),
  ];

  return [
    ...new Set(
      querySources.flatMap((source) =>
        Array.from(source.matchAll(/\b(?:api|nodejs|process)_[a-zA-Z0-9_:]+/gu), ([name]) => name),
      ),
    ),
  ].sort();
}

describe('observability alert contract', () => {
  it('scrapes authenticated API metrics and wires operational alerts', () => {
    const prometheus = readInfraFile('prometheus/prometheus.yml');
    const rules = readInfraFile('prometheus/rules/api-alerts.yml');
    expect(prometheus).toContain('metrics_path: /internal/metrics');
    expect(prometheus).toContain(
      'credentials_file: /etc/prometheus/secrets/api-metrics-bearer-token',
    );
    for (const alert of [
      'ApiHigh5xxRate',
      'ApiP95LatencyHigh',
      'AuthCleanupFailed',
      'AuthCleanupBatchSaturated',
      'AuthMailFailureSpike',
      'AuthMailOutboxLagHigh',
    ]) {
      expect(rules).toContain(alert);
    }
  });

  it('renders Slack routing without committed webhook secrets', () => {
    const env = readInfraFile('.env.observability.example');
    const template = readInfraFile('alertmanager/alertmanager.yml.template');
    expect(env).toContain('SLACK_ALERTMANAGER_ENABLED=false');
    expect(env).not.toContain('hooks.slack.com/services/');
    expect(template).toContain('__SLACK_ALERT_WEBHOOK_URL__');
    expect(readInfraFile('alertmanager/alertmanager.noop.yml.template')).toContain(
      'receiver: noop',
    );
  });

  it('does not use request-scoped labels in queries or alert rules', () => {
    const config = [
      readInfraFile('prometheus/prometheus.yml'),
      readInfraFile('prometheus/rules/api-alerts.yml'),
      ...readDashboardFiles().map((file) => file.source),
    ].join('\n');
    for (const label of forbiddenLabels) {
      expect(config).not.toMatch(new RegExp(`[,{]\\s*${label}\\s*=`));
    }
  });

  it('locks the metric families referenced by Prometheus rules and Grafana queries', () => {
    expect(collectPrometheusQueryMetricFamilies()).toEqual([
      ...trackedPrometheusQueryMetricFamilies,
    ]);
  });

  it('routes bounded Web BFF failure symptoms through the Loki ruler', () => {
    const loki = readInfraFile('loki/loki.yml');
    const rules = readInfraFile('loki/rules/web-bff-alerts.yml');
    expect(loki).toContain('alertmanager_url: http://alertmanager:9093');
    expect(rules).toContain('WebBffFailureRateHigh');
    expect(rules).toContain('web_bff_request_completed');
    for (const label of forbiddenLabels) {
      expect(rules).not.toMatch(new RegExp(`[,{]\\s*${label}\\s*=`));
    }
  });
});
