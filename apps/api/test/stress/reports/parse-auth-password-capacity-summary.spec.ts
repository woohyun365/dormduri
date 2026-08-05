import { describe, expect, it } from 'vitest';

import { parseAuthPasswordCapacitySummary } from './parse-auth-password-capacity-summary.js';

describe('parseAuthPasswordCapacitySummary', () => {
  it('keeps only bounded operation latency/error evidence', () => {
    const report = parseAuthPasswordCapacitySummary(
      {
        metrics: {
          'http_req_duration{operation:login_success}': {
            values: { 'p(95)': 420, 'p(99)': 810 },
            thresholds: { 'p(95)<750': { ok: true } },
          },
          'http_req_failed{operation:login_success}': {
            values: { rate: 0 },
            thresholds: { 'rate<0.01': { ok: true } },
          },
        },
      },
      'h1',
    );

    expect(report).toEqual({
      schemaVersion: 1,
      profile: 'h1',
      status: 'passed',
      operationMetrics: {
        login_success: { p95: 420, p99: 810, failedRate: 0 },
      },
      failedThresholds: [],
      secretMaterialDetected: false,
    });
    expect(JSON.stringify(report)).not.toContain('password');
    expect(JSON.stringify(report)).not.toContain('email');
    expect(JSON.stringify(report)).not.toContain('token');
  });

  it('fails the decision when any k6 threshold fails', () => {
    const report = parseAuthPasswordCapacitySummary(
      {
        metrics: {
          'http_req_duration{operation:signup}': {
            values: { 'p(95)': 1_800, 'p(99)': 3_200 },
            thresholds: { 'p(95)<1000': { ok: false } },
          },
        },
      },
      'h4',
    );

    expect(report.status).toBe('failed');
    expect(report.failedThresholds).toEqual(['http_req_duration{operation:signup}: p(95)<1000']);
  });

  it('omits operations that the selected profile does not execute', () => {
    const report = parseAuthPasswordCapacitySummary(
      {
        metrics: {
          'http_req_duration{operation:login_failure}': {
            values: { 'p(95)': 90, 'p(99)': 120 },
          },
          'http_req_duration{operation:roommate_read}': {
            values: { 'p(95)': 0, 'p(99)': 0 },
          },
        },
      },
      'h1',
    );

    expect(report.operationMetrics).toEqual({
      login_failure: { p95: 90, p99: 120 },
    });
  });
});
