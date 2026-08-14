import { describe, expect, it } from 'vitest';

import { parseArtillerySummary, parseArtillerySummaryJson } from './parse-artillery-summary.js';

describe('parseArtillerySummary', () => {
  it('Artillery aggregate counters/summaries를 realtime safe report로 변환한다', () => {
    const report = parseArtillerySummary(
      {
        aggregate: {
          counters: {
            'vusers.created': 10,
            'vusers.completed': 10,
            'vusers.failed': 0,
            'socketio.emit': 20,
            'stress.realtime.ticket_issued': 10,
            'stress.realtime.subscribe_ack': 10,
          },
          summaries: {
            'socketio.response_time': { min: 1, max: 90, median: 20, p95: 70, p99: 89 },
            'stress.realtime.ticket_issue_ms': { min: 2, max: 40, median: 10, p95: 30, p99: 39 },
            'stress.realtime.subscribe_ack_ms': { min: 1, max: 50, median: 12, p95: 33, p99: 49 },
          },
        },
      },
      { scenarioName: 'smoke', artilleryExitCode: 0 },
    );

    expect(report.status).toBe('passed');
    expect(report.metrics.vusersCreated.count).toBe(10);
    expect(report.metrics.socketioResponseTime.p95).toBe(70);
    expect(report.metrics.realtimeTicketIssued.count).toBe(10);
    expect(report.metrics.realtimeSubscribeAckMs.p99).toBe(49);
    expect(report.failedReasons).toEqual([]);
  });

  it('Artillery exit code와 vusers.failed를 실패 이유로 보존한다', () => {
    const report = parseArtillerySummary(
      {
        aggregate: {
          counters: {
            'vusers.failed': 2,
          },
        },
      },
      { scenarioName: 'baseline-250', artilleryExitCode: 1 },
    );

    expect(report.status).toBe('failed');
    expect(report.failedReasons).toEqual(['artillery exited with 1', 'vusers.failed=2']);
  });

  it('summary JSON이 secret-like 문자열을 포함해도 실패 이유는 redaction한다', () => {
    const report = parseArtillerySummaryJson(
      JSON.stringify({ aggregate: { counters: { 'vusers.failed': 0 } } }),
      { scenarioName: 'peak-500', artilleryExitCode: 99 },
    );

    expect(report.status).toBe('failed');
    expect(report.failedReasons).toEqual(['artillery exited with 99']);
  });
});
