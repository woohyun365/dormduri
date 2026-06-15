import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const processor = require('./processor.cjs') as {
  validateRealtimeScenario: (context: TestContext, events: TestEvents, done?: Done) => void;
  setRealtimeTicketRequest: (
    requestParams: TestRequestParams,
    context: TestContext,
    events: TestEvents,
    done?: Done,
  ) => void;
  captureRealtimeTicketResponse: (
    requestParams: TestRequestParams,
    response: TestResponse,
    context: TestContext,
    events: TestEvents,
    done?: Done,
  ) => void;
  recordRealtimeSubscribeAttempt: (context: TestContext, events: TestEvents, done?: Done) => void;
  recordRealtimeSubscribeAck: (context: TestContext, events: TestEvents, done?: Done) => void;
  buildSafeRealtimeLog: (value: unknown) => unknown;
};

type Done = (error?: Error | null) => void;

interface TestContext {
  vars: Record<string, unknown>;
}

interface TestRequestParams {
  headers?: Record<string, string>;
}

interface TestResponse {
  statusCode: number;
  body?: unknown;
}

interface TestEvents {
  emit: ReturnType<typeof vi.fn>;
}

function createEvents(): TestEvents {
  return { emit: vi.fn() };
}

describe('Artillery realtime processor', () => {
  it('actor token artifact row에서 access token과 threadId가 없으면 fail-closed한다', () => {
    const done = vi.fn();

    processor.validateRealtimeScenario({ vars: { actorId: 'actor-1' } }, createEvents(), done);

    const error: unknown = done.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toContain('accessToken');
  });

  it('ticket request에 bearer access token을 주입하되 log-safe helper는 secret을 redaction한다', () => {
    const requestParams: TestRequestParams = {};
    const events = createEvents();

    processor.setRealtimeTicketRequest(
      requestParams,
      { vars: { accessToken: 'access-token-1', threadId: 'thread-1' } },
      events,
    );

    expect(requestParams.headers?.Authorization).toBe('Bearer access-token-1');
    expect(requestParams.headers?.['User-Agent']).toBe('knu-roommate-artillery-realtime-stress');
    expect(processor.buildSafeRealtimeLog({ accessToken: 'secret', ticket: 'ticket-1' })).toEqual({
      accessToken: '[REDACTED_STRESS_SECRET]',
      ticket: '[REDACTED_STRESS_SECRET]',
    });
  });

  it('ticket response를 context realtimeTicket으로 저장하고 custom metric을 남긴다', () => {
    const context: TestContext = { vars: { accessToken: 'access-token-1', threadId: 'thread-1' } };
    const events = createEvents();

    processor.captureRealtimeTicketResponse(
      {},
      { statusCode: 201, body: JSON.stringify({ ticket: 'ticket-1', expiresInSeconds: 60 }) },
      context,
      events,
    );

    expect(context.vars.realtimeTicket).toBe('ticket-1');
    expect(events.emit).toHaveBeenCalledWith('counter', 'stress.realtime.ticket_issued', 1);
    expect(events.emit).toHaveBeenCalledWith(
      'histogram',
      'stress.realtime.ticket_issue_ms',
      expect.any(Number),
    );
  });

  it('subscribe ack latency metric을 남긴다', () => {
    const context: TestContext = { vars: { subscribeStartedAt: Date.now() - 3 } };
    const events = createEvents();

    processor.recordRealtimeSubscribeAttempt(context, events);
    processor.recordRealtimeSubscribeAck(context, events);

    expect(events.emit).toHaveBeenCalledWith('counter', 'stress.realtime.subscribe_attempt', 1);
    expect(events.emit).toHaveBeenCalledWith('counter', 'stress.realtime.subscribe_ack', 1);
    expect(events.emit).toHaveBeenCalledWith(
      'histogram',
      'stress.realtime.subscribe_ack_ms',
      expect.any(Number),
    );
  });
});
