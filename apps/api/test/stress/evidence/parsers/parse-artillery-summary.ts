import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { redactStressFixtureSecrets } from '../../safety/stress-secret-redaction.js';

export interface ArtilleryMetricSnapshot {
  readonly count?: number;
  readonly rate?: number;
  readonly p95?: number;
  readonly p99?: number;
  readonly median?: number;
  readonly min?: number;
  readonly max?: number;
}

export interface ParsedArtillerySummaryReport {
  readonly scenarioName: string;
  readonly status: 'passed' | 'failed';
  readonly artilleryExitCode: number;
  readonly metrics: {
    readonly vusersCreated: ArtilleryMetricSnapshot;
    readonly vusersCompleted: ArtilleryMetricSnapshot;
    readonly vusersFailed: ArtilleryMetricSnapshot;
    readonly socketioEmit: ArtilleryMetricSnapshot;
    readonly socketioResponseTime: ArtilleryMetricSnapshot;
    readonly httpResponseTime: ArtilleryMetricSnapshot;
    readonly realtimeTicketIssued: ArtilleryMetricSnapshot;
    readonly realtimeSubscribeAck: ArtilleryMetricSnapshot;
    readonly realtimeTicketIssueMs: ArtilleryMetricSnapshot;
    readonly realtimeSubscribeAckMs: ArtilleryMetricSnapshot;
  };
  readonly failedReasons: readonly string[];
}

export function parseArtillerySummary(
  summary: unknown,
  options: { readonly scenarioName: string; readonly artilleryExitCode?: number },
): ParsedArtillerySummaryReport {
  const root = asRecord(summary, 'Artillery summary');
  const aggregate = asOptionalRecord(root.aggregate) ?? root;
  const counters = asOptionalRecord(aggregate.counters) ?? {};
  const rates = asOptionalRecord(aggregate.rates) ?? {};
  const summaries = asOptionalRecord(aggregate.summaries) ?? {};
  const histograms = asOptionalRecord(aggregate.histograms) ?? {};
  const artilleryExitCode = options.artilleryExitCode ?? 0;
  const vusersFailed = readMetric(counters, rates, summaries, histograms, 'vusers.failed');
  const failedReasons = [
    ...(artilleryExitCode === 0 ? [] : [`artillery exited with ${artilleryExitCode}`]),
    ...((vusersFailed.count ?? 0) > 0 ? [`vusers.failed=${vusersFailed.count}`] : []),
  ];

  return {
    scenarioName: options.scenarioName,
    status: failedReasons.length === 0 ? 'passed' : 'failed',
    artilleryExitCode,
    metrics: {
      vusersCreated: readMetric(counters, rates, summaries, histograms, 'vusers.created'),
      vusersCompleted: readMetric(counters, rates, summaries, histograms, 'vusers.completed'),
      vusersFailed,
      socketioEmit: readMetric(counters, rates, summaries, histograms, 'socketio.emit'),
      socketioResponseTime: readMetric(
        counters,
        rates,
        summaries,
        histograms,
        'socketio.response_time',
      ),
      httpResponseTime: readMetric(counters, rates, summaries, histograms, 'http.response_time'),
      realtimeTicketIssued: readMetric(
        counters,
        rates,
        summaries,
        histograms,
        'stress.realtime.ticket_issued',
      ),
      realtimeSubscribeAck: readMetric(
        counters,
        rates,
        summaries,
        histograms,
        'stress.realtime.subscribe_ack',
      ),
      realtimeTicketIssueMs: readMetric(
        counters,
        rates,
        summaries,
        histograms,
        'stress.realtime.ticket_issue_ms',
      ),
      realtimeSubscribeAckMs: readMetric(
        counters,
        rates,
        summaries,
        histograms,
        'stress.realtime.subscribe_ack_ms',
      ),
    },
    failedReasons: failedReasons.map(redactReportString),
  };
}

export function parseArtillerySummaryJson(
  json: string,
  options: { readonly scenarioName: string; readonly artilleryExitCode?: number },
): ParsedArtillerySummaryReport {
  return parseArtillerySummary(JSON.parse(json) as unknown, options);
}

function readMetric(
  counters: Record<string, unknown>,
  rates: Record<string, unknown>,
  summaries: Record<string, unknown>,
  histograms: Record<string, unknown>,
  metricName: string,
): ArtilleryMetricSnapshot {
  const summary =
    asOptionalRecord(summaries[metricName]) ?? asOptionalRecord(histograms[metricName]);
  const counterValue = readNumber(counters, metricName);
  const rateValue = readNumber(rates, metricName);

  return stripUndefined({
    count: counterValue,
    rate: rateValue,
    p95: readNumber(summary, 'p95') ?? readNumber(summary, 'p(95)'),
    p99: readNumber(summary, 'p99') ?? readNumber(summary, 'p(99)'),
    median: readNumber(summary, 'median'),
    min: readNumber(summary, 'min'),
    max: readNumber(summary, 'max'),
  });
}

function redactReportString(value: string): string {
  const redacted = redactStressFixtureSecrets(value);
  return typeof redacted === 'string' ? redacted : '[REDACTED_STRESS_SECRET]';
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
      'Usage: parse-artillery-summary.ts <summary.json> --scenario <name> [--artillery-exit-code <code>]',
    );
  }

  const scenarioIndex = rest.indexOf('--scenario');
  const exitCodeIndex = rest.indexOf('--artillery-exit-code');
  const scenarioName = scenarioIndex >= 0 ? rest[scenarioIndex + 1] : 'unknown';
  const rawExitCode = exitCodeIndex >= 0 ? rest[exitCodeIndex + 1] : undefined;

  return {
    summaryPath,
    scenarioName: scenarioName || 'unknown',
    artilleryExitCode: rawExitCode ? Number.parseInt(rawExitCode, 10) : 0,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs(process.argv.slice(2));
  const report = parseArtillerySummaryJson(readFileSync(args.summaryPath, 'utf8'), {
    scenarioName: args.scenarioName,
    artilleryExitCode: args.artilleryExitCode,
  });
  const safeReport = redactStressFixtureSecrets(report);

  console.log(JSON.stringify(safeReport, null, 2));
  process.exit(report.status === 'passed' ? 0 : 1);
}
