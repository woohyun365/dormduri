import { describe, expect, it } from 'vitest';
import { readDashboardFiles, readInfraFile } from './observability-test.support.js';

const forbiddenLabels = ['email', 'ip', 'requestId', 'sessionId', 'threadId', 'token', 'userId'];

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
