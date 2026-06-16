import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { redactStressFixtureSecrets } from '../safety/stress-secret-redaction.js';

export interface K6MetricSnapshot {
  readonly count?: number;
  readonly rate?: number;
  readonly p95?: number;
  readonly p99?: number;
  readonly avg?: number;
  readonly min?: number;
  readonly max?: number;
  readonly passes?: number;
  readonly fails?: number;
}

export interface K6ThresholdResult {
  readonly metric: string;
  readonly expression: string;
  readonly ok: boolean;
}

export interface ParsedK6SummaryReport {
  readonly scenarioName: string;
  readonly status: 'passed' | 'failed';
  readonly k6ExitCode: number;
  readonly durationMs?: number;
  readonly metrics: {
    readonly httpReqDuration: K6MetricSnapshot;
    readonly httpReqFailed: K6MetricSnapshot;
    readonly checks: K6MetricSnapshot;
    readonly iterations: K6MetricSnapshot;
  };
  readonly thresholds: readonly K6ThresholdResult[];
  readonly failedThresholds: readonly K6ThresholdResult[];
}

export function parseK6Summary(
  summary: unknown,
  options: { readonly scenarioName: string; readonly k6ExitCode?: number },
): ParsedK6SummaryReport {
  const root = asRecord(summary, 'k6 summary');
  const metrics = asOptionalRecord(root.metrics) ?? {};
  const thresholds = collectThresholdResults(metrics);
  const k6ExitCode = options.k6ExitCode ?? 0;
  const failedThresholds = thresholds.filter((threshold) => !threshold.ok);
  const status = k6ExitCode === 0 && failedThresholds.length === 0 ? 'passed' : 'failed';

  return {
    scenarioName: options.scenarioName,
    status,
    k6ExitCode,
    durationMs: readNumber(asOptionalRecord(root.state), 'testRunDurationMs'),
    metrics: {
      httpReqDuration: readMetricSnapshot(metrics, 'http_req_duration'),
      httpReqFailed: readMetricSnapshot(metrics, 'http_req_failed'),
      checks: readMetricSnapshot(metrics, 'checks'),
      iterations: readMetricSnapshot(metrics, 'iterations'),
    },
    thresholds,
    failedThresholds,
  };
}

export function parseK6SummaryJson(
  json: string,
  options: { readonly scenarioName: string; readonly k6ExitCode?: number },
): ParsedK6SummaryReport {
  return parseK6Summary(JSON.parse(json) as unknown, options);
}

function readMetricSnapshot(
  metrics: Record<string, unknown>,
  metricName: string,
): K6MetricSnapshot {
  const metric = asOptionalRecord(metrics[metricName]);
  const values = asOptionalRecord(metric?.values) ?? metric ?? {};

  return stripUndefined({
    count: readNumber(values, 'count'),
    rate: readNumber(values, 'rate') ?? readNumber(values, 'value'),
    p95: readNumber(values, 'p(95)'),
    p99: readNumber(values, 'p(99)'),
    avg: readNumber(values, 'avg'),
    min: readNumber(values, 'min'),
    max: readNumber(values, 'max'),
    passes: readNumber(values, 'passes'),
    fails: readNumber(values, 'fails'),
  });
}

function collectThresholdResults(metrics: Record<string, unknown>): readonly K6ThresholdResult[] {
  return Object.entries(metrics).flatMap(([metricName, metricValue]) => {
    const thresholds = asOptionalRecord(asOptionalRecord(metricValue)?.thresholds);
    if (!thresholds) {
      return [];
    }

    return Object.entries(thresholds).map(([expression, result]) => ({
      metric: redactReportString(metricName),
      expression: redactReportString(expression),
      ok: readThresholdOk(result),
    }));
  });
}

function redactReportString(value: string): string {
  const redacted = redactStressFixtureSecrets(value);
  return typeof redacted === 'string' ? redacted : '[REDACTED_STRESS_SECRET]';
}

function readThresholdOk(result: unknown): boolean {
  if (typeof result === 'boolean') {
    return result === false;
  }

  const record = asOptionalRecord(result);
  const ok = record?.ok;

  return ok === true;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  const record = asOptionalRecord(value);
  if (!record) {
    throw new Error(`${label} must be an object.`);
  }

  return record;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stripUndefined<T extends Record<string, number | undefined>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
}

function parseCliArgs(argv: readonly string[]) {
  const [summaryPath, ...rest] = argv;

  if (!summaryPath) {
    throw new Error(
      'Usage: parse-k6-summary.ts <summary.json> --scenario <name> [--k6-exit-code <code>]',
    );
  }

  const scenarioIndex = rest.indexOf('--scenario');
  const exitCodeIndex = rest.indexOf('--k6-exit-code');
  const scenarioName = scenarioIndex >= 0 ? rest[scenarioIndex + 1] : 'unknown';
  const rawExitCode = exitCodeIndex >= 0 ? rest[exitCodeIndex + 1] : undefined;

  return {
    summaryPath,
    scenarioName: scenarioName || 'unknown',
    k6ExitCode: rawExitCode ? Number.parseInt(rawExitCode, 10) : 0,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs(process.argv.slice(2));
  const report = parseK6SummaryJson(readFileSync(args.summaryPath, 'utf8'), {
    scenarioName: args.scenarioName,
    k6ExitCode: args.k6ExitCode,
  });
  const safeReport = redactStressFixtureSecrets(report);

  console.log(JSON.stringify(safeReport, null, 2));
  process.exit(report.status === 'passed' ? 0 : 1);
}
