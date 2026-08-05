import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const observabilityRoot = join(repoRoot, 'infra/observability');
const dashboardsRoot = join(observabilityRoot, 'grafana/dashboards');
const stressRoot = join(apiRoot, 'test/stress');
const stressReleaseRunbookPath = join(
  repoRoot,
  'docs/runbooks/observability/api-stress-release-runbook.md',
);
const stressReportTemplatePath = join(stressRoot, 'evidence/renderers/report-template.md');
const slackTroubleshootingRunbookPath = join(
  repoRoot,
  'docs/runbooks/observability/slack-alert-runbook.md',
);
const apiReleaseSmokePath = join(repoRoot, 'infra/deploy/scripts/api-release-smoke.sh');
const authRegistrationCredentialRunbookPath = join(
  repoRoot,
  'infra/runbooks/auth-registration-credential-release-evidence.md',
);

const requiredFiles = [
  'docker-compose.observability.yml',
  '.env.observability.example',
  'prometheus/prometheus.yml',
  'prometheus/render-prometheus-config.sh',
  'prometheus/rules/api-alerts.yml',
  'prometheus/rules/slack-alert-smoke.yml',
  'alertmanager/render-alertmanager-config.sh',
  'alertmanager/alertmanager.yml.template',
  'alertmanager/alertmanager.noop.yml.template',
  'alertmanager/alertmanager.yml.example',
  'alertmanager/templates/slack.tmpl',
  'alertmanager/README.md',
  'slack/send-alertmanager-smoke.sh',
  'slack/slack-setup-runbook.md',
  'slack/slack-alert-payload.md',
  'prometheus/secrets/api-metrics-bearer-token.example',
  'grafana/provisioning/datasources/datasources.yml',
  'grafana/provisioning/dashboards/dashboards.yml',
  'grafana/dashboards/api-overview.json',
  'grafana/dashboards/realtime-auth-retention.json',
  'loki/loki.yml',
  'alloy/config.alloy',
  'README.md',
  'rehearsal-checklist.md',
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
  'api_auth_cleanup_batch_saturated',
  'api_auth_cleanup_deleted_total',
  'api_auth_cleanup_failures_total',
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
    expect(compose).toContain('alertmanager:');
    expect(compose).toContain('grafana:');
    expect(compose).toContain('loki:');
    expect(compose).toContain('alloy:');
    expect(compose).toContain('127.0.0.1:${PROMETHEUS_PORT:-9090}:9090');
    expect(compose).toContain('127.0.0.1:${ALERTMANAGER_PORT:-9093}:9093');
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
    const slackSmokeRules = readInfraFile('prometheus/rules/slack-alert-smoke.yml');

    expect(compose).toContain('entrypoint:');
    expect(compose).toContain('/bin/sh');
    expect(compose).toContain('/etc/prometheus/render-prometheus-config.sh');
    expect(prometheusConfig).toContain('job_name: api');
    expect(prometheusConfig).toContain('metrics_path: /internal/metrics');
    expect(prometheusConfig).toContain(
      'credentials_file: /etc/prometheus/secrets/api-metrics-bearer-token',
    );
    expect(prometheusConfig).toContain('__API_METRICS_TARGET__');
    expect(prometheusConfig).toContain('alerting:');
    expect(prometheusConfig).toContain('alertmanager:9093');
    expect(renderScript).toContain('API_METRICS_TARGET');
    expect(renderScript).toContain('/bin/prometheus');
    expect(rules).toContain('ApiHigh5xxRate');
    expect(rules).toContain('ApiP95LatencyHigh');
    expect(rules).toContain('RealtimeOutboxLagHigh');
    expect(rules).toContain('PrismaPoolWaitingHigh');
    expect(rules).toContain('RetentionReviewBacklogHigh');
    expect(rules).toContain('AuthCleanupFailed');
    expect(rules).toContain('AuthCleanupBatchSaturated');
    expect(slackSmokeRules).toContain('SlackAlertSmokeNonFiring');
    expect(slackSmokeRules).toContain('expr: vector(0) == 1');
  });

  it('routes alerts through Alertmanager without committing Slack webhook secrets', () => {
    const compose = readInfraFile('docker-compose.observability.yml');
    const envExample = readInfraFile('.env.observability.example');
    const renderScript = readInfraFile('alertmanager/render-alertmanager-config.sh');
    const slackTemplate = readInfraFile('alertmanager/alertmanager.yml.template');
    const noopTemplate = readInfraFile('alertmanager/alertmanager.noop.yml.template');
    const slackPayloadPolicy = readInfraFile('slack/slack-alert-payload.md');
    const rehearsalChecklist = readInfraFile('rehearsal-checklist.md');

    expect(compose).toContain('SLACK_ALERTMANAGER_ENABLED');
    expect(compose).toContain('SLACK_ALERT_WEBHOOK_URL');
    expect(compose).toContain('SLACK_ALERT_CHANNEL');
    expect(compose).toContain('/etc/alertmanager/render-alertmanager-config.sh');
    expect(envExample).toContain('SLACK_ALERTMANAGER_ENABLED=false');
    expect(envExample).toContain('SLACK_ALERT_WEBHOOK_URL=');
    expect(envExample).not.toContain('hooks.slack.com/services/');
    expect(renderScript).toContain('alertmanager.noop.yml.template');
    expect(renderScript).toContain('alertmanager.yml.template');
    expect(slackTemplate).toContain('slack_configs:');
    expect(slackTemplate).toContain('__SLACK_ALERT_WEBHOOK_URL__');
    expect(slackTemplate).toContain('__SLACK_ALERT_CHANNEL__');
    expect(noopTemplate).toContain('receiver: noop');
    expect(slackPayloadPolicy).toContain('Forbidden');
    expect(slackPayloadPolicy).toContain('RRPD payload');
    expect(readInfraFile('alertmanager/templates/slack.tmpl')).toContain('• *env*:');
    expect(rehearsalChecklist).toContain('SlackAlertSmokeNonFiring');
    expect(rehearsalChecklist).toContain('alertmanager_notification_requests_failed_total');
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

  it('keeps dashboard queries aligned with API metric names', () => {
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
    expect(alloy).toContain('__meta_docker_container_label_com_docker_compose_service');
    expect(alloy).not.toContain('"service" = "api"');
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
      readInfraFile('prometheus/rules/slack-alert-smoke.yml'),
      readInfraFile('alertmanager/alertmanager.yml.template'),
      ...readDashboardFiles().map((dashboard) => dashboard.source),
    ].join('\n');

    for (const forbiddenLabelName of forbiddenLabelNames) {
      const labelSelector = new RegExp(`[,{]\\s*${forbiddenLabelName}\\s*=`, 'u');
      expect(configText).not.toMatch(labelSelector);
    }
  });

  it('wires auth reset abuse, mail failure, and outbox lag metrics to alert fixtures', () => {
    const rules = readInfraFile('prometheus/rules/api-alerts.yml');

    expect(rules).toContain('alert: AuthMailFailureSpike');
    expect(rules).toContain('api_auth_mail_dispatch_total{outcome=~"failed|unknown"}');
    expect(rules).toContain('alert: AuthMailOutboxLagHigh');
    expect(rules).toContain('api_auth_mail_outbox_lag_seconds > 60');
  });

  it('keeps credential lifecycle metrics in the API release smoke gate', () => {
    const releaseSmoke = readFileSync(apiReleaseSmokePath, 'utf8');

    for (const metric of [
      'api_auth_signup_nickname_validation_total',
      'api_auth_signup_final_admission_total',
      'api_auth_signup_password_hash_total',
      'api_auth_signup_password_hash_duration_seconds',
      'api_auth_sensitive_mutations_total',
    ]) {
      expect(releaseSmoke).toContain(metric);
    }
  });

  it('documents the registration and credential lifecycle release evidence gate', () => {
    expect(existsSync(authRegistrationCredentialRunbookPath)).toBe(true);

    const runbook = readFileSync(authRegistrationCredentialRunbookPath, 'utf8');
    expect(runbook).toContain('auth/registration/signup-transaction.integration.spec.ts');
    expect(runbook).toContain('migration-status.integration.spec.ts');
    expect(runbook).toContain('api_auth_signup_final_admission_total');
    expect(runbook).toContain('argon_19mib_mixed_workload: pass | fail | blocked');
    expect(runbook).toContain('redaction_confirmed: true');
  });

  it('documents the stress release gate and safe report template', () => {
    expect(existsSync(stressReleaseRunbookPath)).toBe(true);
    expect(existsSync(stressReportTemplatePath)).toBe(true);
    expect(existsSync(slackTroubleshootingRunbookPath)).toBe(true);

    const runbook = readFileSync(stressReleaseRunbookPath, 'utf8');
    const reportTemplate = readFileSync(stressReportTemplatePath, 'utf8');
    const slackRunbook = readFileSync(slackTroubleshootingRunbookPath, 'utf8');

    expect(runbook).toContain('STRESS_ALLOWED_HOSTS');
    expect(runbook).toContain('stress:fixture:reset');
    expect(runbook).toContain('stress:realtime:smoke');
    expect(runbook).toContain('one-time ticket');
    expect(runbook).toContain('report-template.md');
    expect(reportTemplate).toContain('Raw token/ticket/cookie/password/email omitted');
    expect(reportTemplate).toContain('k6 safe parser summary');
    expect(reportTemplate).toContain('Artillery safe parser summary');
    expect(slackRunbook).toContain('SLACK_ALERTMANAGER_ENABLED=true');
    expect(slackRunbook).toContain('Payload privacy');
  });

  it('documents a reproducible BE observability rehearsal sequence', () => {
    const readme = readInfraFile('README.md');
    const checklist = readInfraFile('rehearsal-checklist.md');

    expect(readme).toContain('rehearsal-checklist.md');
    expect(checklist).toContain('docker-compose.api.yml');
    expect(checklist).toContain('/health/ready');
    expect(checklist).toContain('/internal/metrics');
    expect(checklist).toContain('api:4000');
    expect(checklist).toContain('send-alertmanager-smoke.sh');
    expect(checklist).toContain('stress:docker:smoke');
    expect(checklist).toContain('#281');
  });
});
