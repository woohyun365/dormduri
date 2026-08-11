import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';

const forbiddenValue = /(?:change[-_]?me|example|local-only|replace[_-]?me|password)/iu;

export function validateProductionObservabilityEnvironment(
  environment,
  { baseDirectory = process.cwd() } = {},
) {
  const failures = [];
  const required = (key) => {
    const value = environment[key]?.trim();
    if (!value) failures.push(`${key} is required`);
    return value ?? '';
  };

  const observabilityEnvironment = required('OBSERVABILITY_ENV');
  const metricsTarget = required('API_METRICS_TARGET');
  const metricsTokenFile = required('API_METRICS_BEARER_TOKEN_FILE');
  const grafanaUser = required('GRAFANA_ADMIN_USER');
  const grafanaPassword = required('GRAFANA_ADMIN_PASSWORD');

  if (observabilityEnvironment !== 'production') {
    failures.push('OBSERVABILITY_ENV must be production');
  }
  if (/^(?:localhost|127\.0\.0\.1|host\.docker\.internal):/u.test(metricsTarget)) {
    failures.push('API_METRICS_TARGET must use the private runtime network');
  }
  if (grafanaUser.toLowerCase() === 'admin' || grafanaUser.toLowerCase() === 'root') {
    failures.push('GRAFANA_ADMIN_USER must be an operator-specific account');
  }
  if (grafanaPassword.length < 16 || forbiddenValue.test(grafanaPassword)) {
    failures.push(
      'GRAFANA_ADMIN_PASSWORD must be a non-placeholder value of at least 16 characters',
    );
  }

  const tokenPath = resolve(baseDirectory, metricsTokenFile);
  if (!metricsTokenFile || /(?:\.example|\.local)$/u.test(metricsTokenFile)) {
    failures.push('API_METRICS_BEARER_TOKEN_FILE must not use an example or local fixture');
  } else if (!existsSync(tokenPath)) {
    failures.push('API_METRICS_BEARER_TOKEN_FILE does not exist');
  } else {
    const token = readFileSync(tokenPath, 'utf8').trim();
    if (token.length < 32 || forbiddenValue.test(token)) {
      failures.push(
        'metrics bearer token must be a non-placeholder value of at least 32 characters',
      );
    }
  }

  for (const [key, expected] of [
    ['PROMETHEUS_RETENTION', '15d'],
    ['ALERTMANAGER_RETENTION', '120h'],
  ]) {
    if (required(key) !== expected)
      failures.push(`${key} must match the production operations contract`);
  }

  if (environment.SLACK_ALERTMANAGER_ENABLED === 'true') {
    const webhook = required('SLACK_ALERT_WEBHOOK_URL');
    if (!/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/u.test(webhook)) {
      failures.push('enabled Slack delivery requires a Slack Incoming Webhook URL');
    }
  }

  if (failures.length) {
    throw new Error(`Production observability preflight failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    environment: observabilityEnvironment,
    metricsTarget,
    grafanaOperatorConfigured: true,
    slackDeliveryEnabled: environment.SLACK_ALERTMANAGER_ENABLED === 'true',
    retention: {
      prometheus: environment.PROMETHEUS_RETENTION,
      loki: '720h',
      alertmanager: environment.ALERTMANAGER_RETENTION,
    },
  };
}

export function validateProductionObservabilityEnvironmentFile(
  envFile,
  { processEnvironment = process.env } = {},
) {
  const parsed = parseEnv(readFileSync(envFile, 'utf8'));
  return validateProductionObservabilityEnvironment(
    { ...parsed, ...definedEnvironment(processEnvironment) },
    { baseDirectory: dirname(envFile) },
  );
}

function definedEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([, value]) => typeof value === 'string'),
  );
}
