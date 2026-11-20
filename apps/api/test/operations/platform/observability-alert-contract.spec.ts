import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectStrings,
  observabilityRoot,
  readDashboardFiles,
  readInfraFile,
} from './observability-test.support.js';

// Prometheus rule 파일 전부(api·retention·background job·database·host·observability·smoke). 운영 설정 image도 이 디렉터리를
// 통째로 담는다(infra/observability/Dockerfile).
function readPrometheusRuleFiles(): string[] {
  return readdirSync(join(observabilityRoot, 'prometheus/rules'))
    .filter((name) => name.endsWith('.yml'))
    .sort()
    .map((name) => readInfraFile(`prometheus/rules/${name}`));
}

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
  'api_background_job_failures_total',
  'api_background_job_last_success_timestamp_seconds',
  'api_chat_realtime_connected_sockets',
  'api_chat_realtime_rejections_total',
  'api_db_table_dead_tuple_ratio',
  'api_db_table_dead_tuples',
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
    ...readPrometheusRuleFiles(),
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
      readInfraFile('prometheus/prometheus.production.yml'),
      ...readPrometheusRuleFiles(),
      ...readDashboardFiles().map((file) => file.source),
    ].join('\n');
    for (const label of forbiddenLabels) {
      expect(config).not.toMatch(new RegExp(`[,{]\\s*${label}\\s*=`));
    }
  });

  // Slack template(alertmanager/templates/slack.tmpl)은 rule의 summary를 거르지 않고 출력하고 runbook은 저장소 경로 형식만 남긴다.
  // 그래서 Prometheus·Loki rule 파일은 alert마다 한 줄 고정 문구 summary와 저장소 경로 runbook을 두고, template 치환
  // ($labels·$value·{{ }})을 어디에도 쓰지 않는다(infra/observability/slack/slack-alert-payload.md).
  it('keeps every alert summary and runbook annotation as fixed text', () => {
    const ruleFiles = ['prometheus/rules', 'loki/rules'].flatMap((directory) =>
      readdirSync(join(observabilityRoot, directory))
        .filter((name) => name.endsWith('.yml'))
        .sort()
        .map((name) => `${directory}/${name}`),
    );
    expect(ruleFiles).toContain('loki/rules/web-bff-alerts.yml');
    for (const file of ruleFiles) {
      const source = readInfraFile(file);
      expect(source, file).not.toMatch(/\{\{|\}\}|\$labels|\$value|\$externalLabels/u);
      const alerts = source.match(/^\s*- alert:/gmu)?.length ?? 0;
      const summaries = [...source.matchAll(/^\s+summary:\s*(.*)$/gmu)].map((match) => match[1]);
      const runbooks = [...source.matchAll(/^\s+runbook:\s*(.*)$/gmu)].map((match) => match[1]);
      expect(alerts, file).toBeGreaterThan(0);
      expect(summaries, file).toHaveLength(alerts);
      expect(runbooks, file).toHaveLength(alerts);
      for (const summary of summaries) expect(summary, file).toMatch(/^[^\s|>'"][^{}$]*$/u);
      for (const runbook of runbooks) {
        expect(runbook, file).toMatch(
          /^(?:infra|docs)\/[A-Za-z0-9/_.-]+(?:#[\p{Script=Hangul}A-Za-z0-9_-]+)?$/u,
        );
      }
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
