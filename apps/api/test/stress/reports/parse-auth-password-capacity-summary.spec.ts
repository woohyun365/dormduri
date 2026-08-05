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

  it('H5 report에 spike 종료 60초 뒤의 회복 구간 latency를 보존한다', () => {
    const report = parseAuthPasswordCapacitySummary(
      {
        metrics: {
          'http_req_duration{phase:recovered}': {
            values: { 'p(95)': 220, 'p(99)': 430 },
            thresholds: { 'p(95)<1250': { ok: true }, 'p(99)<2500': { ok: true } },
          },
          'http_req_failed{phase:recovered}': {
            values: { rate: 0 },
            thresholds: { 'rate<0.01': { ok: true } },
          },
          'checks{phase:recovered}': {
            values: { rate: 1 },
            thresholds: { 'rate>0.99': { ok: true } },
          },
        },
      },
      'h5',
    );

    expect(report.recoveryMetrics).toEqual({
      p95: 220,
      p99: 430,
      failedRate: 0,
      checksRate: 1,
    });
  });

  it('H9 report에 동일 actor/IP와 분산 실패의 throttle 결과를 구분해 보존한다', () => {
    const report = parseAuthPasswordCapacitySummary(
      {
        metrics: {
          'auth_throttle_outcome{scope:same_actor_ip}': {
            values: { rate: 0.8 },
            thresholds: { 'rate>0.5': { ok: true } },
          },
          'auth_throttle_outcome{scope:distributed}': {
            values: { rate: 0 },
            thresholds: { 'rate<0.01': { ok: true } },
          },
          'auth_account_lock_outcome{scope:same_actor_ip}': {
            values: { rate: 0.75 },
            thresholds: { 'rate>0.5': { ok: true } },
          },
          'auth_account_lock_outcome{scope:distributed}': {
            values: { rate: 0 },
            thresholds: { 'rate<0.01': { ok: true } },
          },
        },
      },
      'h9',
    );

    expect(report.abuseProtectionMetrics).toEqual({
      sameActorIpThrottleRate: 0.8,
      distributedThrottleRate: 0,
      sameActorIpLockRate: 0.75,
      distributedLockRate: 0,
    });
  });
});
