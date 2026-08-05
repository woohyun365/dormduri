import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OPERATIONS = [
  'login_success',
  'login_failure',
  'signup',
  'reset_password',
  'change_password',
  'roommate_read',
] as const;

type CapacityOperation = (typeof OPERATIONS)[number];

export interface AuthPasswordCapacityOperationSnapshot {
  readonly p95?: number;
  readonly p99?: number;
  readonly failedRate?: number;
}

export interface AuthPasswordCapacityRecoverySnapshot extends AuthPasswordCapacityOperationSnapshot {
  readonly checksRate?: number;
}

export interface AuthPasswordCapacityAbuseProtectionSnapshot {
  readonly sameActorIpThrottleRate?: number;
  readonly distributedThrottleRate?: number;
  readonly sameActorIpLockRate?: number;
  readonly distributedLockRate?: number;
}

export interface AuthPasswordCapacitySummary {
  readonly schemaVersion: 1;
  readonly profile: string;
  readonly status: 'passed' | 'failed';
  readonly operationMetrics: Partial<
    Record<CapacityOperation, AuthPasswordCapacityOperationSnapshot>
  >;
  readonly recoveryMetrics?: AuthPasswordCapacityRecoverySnapshot;
  readonly abuseProtectionMetrics?: AuthPasswordCapacityAbuseProtectionSnapshot;
  readonly failedThresholds: readonly string[];
  readonly secretMaterialDetected: false;
}

export function parseAuthPasswordCapacitySummary(
  summary: unknown,
  profile: string,
): AuthPasswordCapacitySummary {
  const root = asRecord(summary);
  const metrics = asRecord(root.metrics ?? {});
  const failedThresholds = Object.entries(metrics).flatMap(([metricName, value]) => {
    const thresholds = asRecord(asRecord(value).thresholds ?? {});
    return Object.entries(thresholds)
      .filter(([, result]) => !thresholdPassed(result))
      .map(([expression]) => `${metricName}: ${expression}`);
  });
  const operationMetrics = Object.fromEntries(
    operationsForProfile(profile).flatMap((operation) => {
      const duration = metricValues(metrics[`http_req_duration{operation:${operation}}`]);
      const failed = metricValues(metrics[`http_req_failed{operation:${operation}}`]);
      if (!duration && !failed) {
        return [];
      }
      return [
        [
          operation,
          compact({
            p95: readNumber(duration, 'p(95)'),
            p99: readNumber(duration, 'p(99)'),
            failedRate: readNumber(failed, 'rate') ?? readNumber(failed, 'value'),
          }),
        ],
      ];
    }),
  ) as Partial<Record<CapacityOperation, AuthPasswordCapacityOperationSnapshot>>;
  const recoveryMetrics = readRecoveryMetrics(metrics, profile);
  const abuseProtectionMetrics = readAbuseProtectionMetrics(metrics, profile);

  return {
    schemaVersion: 1,
    profile,
    status: failedThresholds.length === 0 ? 'passed' : 'failed',
    operationMetrics,
    ...(recoveryMetrics ? { recoveryMetrics } : {}),
    ...(abuseProtectionMetrics ? { abuseProtectionMetrics } : {}),
    failedThresholds,
    secretMaterialDetected: false,
  };
}

function readAbuseProtectionMetrics(
  metrics: Record<string, unknown>,
  profile: string,
): AuthPasswordCapacityAbuseProtectionSnapshot | undefined {
  if (profile.toLowerCase() !== 'h9') {
    return undefined;
  }
  const sameActorIp = metricValues(metrics['auth_throttle_outcome{scope:same_actor_ip}']);
  const distributed = metricValues(metrics['auth_throttle_outcome{scope:distributed}']);
  const sameActorIpLock = metricValues(metrics['auth_account_lock_outcome{scope:same_actor_ip}']);
  const distributedLock = metricValues(metrics['auth_account_lock_outcome{scope:distributed}']);
  if (!sameActorIp && !distributed && !sameActorIpLock && !distributedLock) {
    return undefined;
  }
  return compact({
    sameActorIpThrottleRate: readNumber(sameActorIp, 'rate') ?? readNumber(sameActorIp, 'value'),
    distributedThrottleRate: readNumber(distributed, 'rate') ?? readNumber(distributed, 'value'),
    sameActorIpLockRate:
      readNumber(sameActorIpLock, 'rate') ?? readNumber(sameActorIpLock, 'value'),
    distributedLockRate:
      readNumber(distributedLock, 'rate') ?? readNumber(distributedLock, 'value'),
  });
}

function readRecoveryMetrics(
  metrics: Record<string, unknown>,
  profile: string,
): AuthPasswordCapacityRecoverySnapshot | undefined {
  if (profile.toLowerCase() !== 'h5') {
    return undefined;
  }
  const duration = metricValues(metrics['http_req_duration{phase:recovered}']);
  const failed = metricValues(metrics['http_req_failed{phase:recovered}']);
  const checks = metricValues(metrics['checks{phase:recovered}']);
  if (!duration && !failed && !checks) {
    return undefined;
  }
  return compact({
    p95: readNumber(duration, 'p(95)'),
    p99: readNumber(duration, 'p(99)'),
    failedRate: readNumber(failed, 'rate') ?? readNumber(failed, 'value'),
    checksRate: readNumber(checks, 'rate') ?? readNumber(checks, 'value'),
  });
}

function operationsForProfile(profile: string): readonly CapacityOperation[] {
  switch (profile.toLowerCase()) {
    case 'h3':
      return OPERATIONS;
    case 'h6':
      return ['login_success', 'signup'];
    case 'h7':
    case 'h8':
      return ['login_success'];
    case 'h9':
      return ['login_failure'];
    default:
      return OPERATIONS.filter((operation) => operation !== 'roommate_read');
  }
}

function metricValues(value: unknown): Record<string, unknown> | null {
  const metric = asRecord(value);
  const values = asRecord(metric.values ?? metric);
  return Object.keys(values).length > 0 ? values : null;
}

function thresholdPassed(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value === false;
  }
  return asRecord(value).ok === true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(record: Record<string, unknown> | null, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function parseCliArgs(argv: readonly string[]) {
  const [summaryPath, outputPath, profile = 'unknown'] = argv;
  if (!summaryPath || !outputPath) {
    throw new Error(
      'Usage: parse-auth-password-capacity-summary.ts <summary.json> <output.json> [profile]',
    );
  }
  return { summaryPath, outputPath, profile };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs(process.argv.slice(2));
  const report = parseAuthPasswordCapacitySummary(
    JSON.parse(readFileSync(args.summaryPath, 'utf8')) as unknown,
    args.profile,
  );
  writeFileSync(args.outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === 'passed' ? 0 : 1);
}
