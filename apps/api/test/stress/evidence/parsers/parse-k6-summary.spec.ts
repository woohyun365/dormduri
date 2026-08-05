import { describe, expect, it } from 'vitest';

import { getStressRedactedPlaceholder } from '../../safety/stress-secret-redaction.js';
import { parseK6Summary, parseK6SummaryJson } from './parse-k6-summary.js';

const passingSummary = {
  state: { testRunDurationMs: 61_000 },
  metrics: {
    http_req_duration: {
      values: { avg: 100, min: 10, max: 900, 'p(95)': 250, 'p(99)': 700 },
      thresholds: { 'p(95)<300': { ok: true }, 'p(99)<800': { ok: true } },
    },
    http_req_failed: {
      values: { rate: 0.001, passes: 1, fails: 999 },
      thresholds: { 'rate<0.01': { ok: true } },
    },
    checks: {
      values: { rate: 0.999, passes: 999, fails: 1 },
      thresholds: { 'rate>0.99': { ok: true } },
    },
    iterations: { values: { count: 1000 } },
  },
};

describe('parseK6Summary', () => {
  it('p95/p99/error/check/threshold 결과를 안전한 report shape로 축약한다', () => {
    const report = parseK6Summary(passingSummary, { scenarioName: 'smoke' });

    expect(report).toMatchObject({
      scenarioName: 'smoke',
      status: 'passed',
      k6ExitCode: 0,
      durationMs: 61_000,
      metrics: {
        httpReqDuration: { avg: 100, min: 10, max: 900, p95: 250, p99: 700 },
        httpReqFailed: { rate: 0.001, passes: 1, fails: 999 },
        checks: { rate: 0.999, passes: 999, fails: 1 },
        iterations: { count: 1000 },
      },
    });
    expect(report.thresholds).toHaveLength(4);
    expect(report.failedThresholds).toEqual([]);
  });

  it('threshold 실패와 k6 exit code 실패를 report failure로 보존한다', () => {
    const report = parseK6Summary(
      {
        metrics: {
          http_req_duration: {
            values: { 'p(95)': 950, 'p(99)': 1800 },
            thresholds: { 'p(95)<300': { ok: false } },
          },
          http_req_failed: { values: { rate: 0.03 }, thresholds: { 'rate<0.01': { ok: false } } },
        },
      },
      { scenarioName: 'baseline-250', k6ExitCode: 99 },
    );

    expect(report.status).toBe('failed');
    expect(report.failedThresholds).toEqual([
      { metric: 'http_req_duration', expression: 'p(95)<300', ok: false },
      { metric: 'http_req_failed', expression: 'rate<0.01', ok: false },
    ]);
  });

  it('k6 v2 summary-export의 direct metric 값과 threshold tainted boolean을 해석한다', () => {
    const report = parseK6Summary(
      {
        metrics: {
          http_req_duration: { avg: 10, min: 1, max: 30, 'p(95)': 20, 'p(99)': 25 },
          http_req_failed: { passes: 0, fails: 30, value: 0 },
          checks: { passes: 60, fails: 0, value: 1 },
          iterations: { count: 10 },
          'http_req_failed{scenario:smoke}': {
            passes: 0,
            fails: 30,
            value: 0,
            thresholds: { 'rate<0.01': false },
          },
          'checks{scenario:smoke}': {
            passes: 60,
            fails: 0,
            value: 1,
            thresholds: { 'rate>0.99': false },
          },
        },
      },
      { scenarioName: 'smoke', k6ExitCode: 0 },
    );

    expect(report.status).toBe('passed');
    expect(report.metrics.httpReqDuration).toMatchObject({ avg: 10, p95: 20, p99: 25 });
    expect(report.metrics.httpReqFailed).toMatchObject({ rate: 0, passes: 0, fails: 30 });
    expect(report.metrics.checks).toMatchObject({ rate: 1, passes: 60, fails: 0 });
    expect(report.thresholds).toEqual([
      { metric: 'http_req_failed{scenario:smoke}', expression: 'rate<0.01', ok: true },
      { metric: 'checks{scenario:smoke}', expression: 'rate>0.99', ok: true },
    ]);
    expect(report.failedThresholds).toEqual([]);
  });

  it('parser output은 raw secret payload를 포함하지 않는다', () => {
    const reportJson = JSON.stringify({
      ...passingSummary,
      metrics: {
        ...passingSummary.metrics,
        'stress_secret_metric{email:stress+0001@example.invalid,token:Bearer abc.def}': {
          values: { count: 1 },
          thresholds: { 'rate<0.01; Cookie: session=secret-session': { ok: false } },
        },
      },
    });

    const report = parseK6SummaryJson(reportJson, { scenarioName: 'smoke' });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('stress+0001@example.invalid');
    expect(serialized).not.toContain('Bearer abc.def');
    expect(serialized).not.toContain('secret-session');
    expect(serialized).toContain(getStressRedactedPlaceholder());
  });
});
