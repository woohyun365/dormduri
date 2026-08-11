import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateProductionObservabilityEnvironment } from './production-environment.mjs';

function withFixture(run) {
  const directory = mkdtempSync('/tmp/knu-observability-env-test-');
  const tokenPath = resolve(directory, 'metrics-token');
  writeFileSync(tokenPath, 'test-token-material-that-is-longer-than-32-characters');
  const environment = {
    OBSERVABILITY_ENV: 'production',
    API_METRICS_TARGET: 'api:4000',
    API_METRICS_BEARER_TOKEN_FILE: tokenPath,
    GRAFANA_ADMIN_USER: 'knu-operator',
    GRAFANA_ADMIN_PASSWORD: 'operator-credential-for-test',
    PROMETHEUS_RETENTION: '15d',
    ALERTMANAGER_RETENTION: '120h',
    SLACK_ALERTMANAGER_ENABLED: 'false',
  };
  try {
    run({ directory, environment });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('accepts a private, bounded and non-placeholder production environment', () => {
  withFixture(({ directory, environment }) => {
    const summary = validateProductionObservabilityEnvironment(environment, {
      baseDirectory: directory,
    });
    assert.equal(summary.environment, 'production');
    assert.equal(summary.metricsTarget, 'api:4000');
  });
});

test('rejects local targets and default operator credentials', () => {
  withFixture(({ directory, environment }) => {
    assert.throws(
      () =>
        validateProductionObservabilityEnvironment(
          {
            ...environment,
            OBSERVABILITY_ENV: 'local',
            API_METRICS_TARGET: 'host.docker.internal:4000',
            GRAFANA_ADMIN_USER: 'admin',
            GRAFANA_ADMIN_PASSWORD: 'change-me-local-only',
          },
          { baseDirectory: directory },
        ),
      /Production observability preflight failed/u,
    );
  });
});

test('rejects enabled Slack delivery without an approved webhook', () => {
  withFixture(({ directory, environment }) => {
    assert.throws(
      () =>
        validateProductionObservabilityEnvironment(
          {
            ...environment,
            SLACK_ALERTMANAGER_ENABLED: 'true',
            SLACK_ALERT_WEBHOOK_URL: 'https://example.invalid/webhook',
          },
          { baseDirectory: directory },
        ),
      /Slack Incoming Webhook/u,
    );
  });
});
