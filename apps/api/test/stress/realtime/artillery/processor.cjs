'use strict';

const REDACTED_STRESS_SECRET = '[REDACTED_STRESS_SECRET]';

function validateRealtimeScenario(context, events, done) {
  try {
    const threadId = readContextVar(context, 'threadId');
    const realtimeTicket = readContextVar(context, 'realtimeTicket');
    const actorId = readContextVar(context, 'actorId') || 'unknown-actor';

    if (!threadId) {
      throw new Error('Realtime stress actor row is missing threadId.');
    }

    if (!realtimeTicket) {
      throw new Error('Realtime stress actor row is missing realtimeTicket.');
    }

    context.vars.actorId = actorId;
    context.vars.threadId = threadId;
    context.vars.realtimeTicket = realtimeTicket;
    emitCounter(events, 'stress.realtime.actor_selected', 1);
    finish(done);
  } catch (error) {
    finish(done, error);
  }
}

function setRealtimeTicketRequest(requestParams, context, events, done) {
  try {
    const accessToken = readContextVar(context, 'accessToken');
    if (!accessToken) {
      throw new Error('Realtime stress ticket request requires accessToken.');
    }

    requestParams.headers = {
      ...(requestParams.headers || {}),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'dormduri-artillery-realtime-stress',
    };
    context.vars.ticketIssueStartedAt = Date.now();
    emitCounter(events, 'stress.realtime.ticket_request', 1);
    finish(done);
  } catch (error) {
    finish(done, error);
  }
}

function captureRealtimeTicketResponse(requestParams, response, context, events, done) {
  try {
    const statusCode = Number(response && response.statusCode);
    if (statusCode < 200 || statusCode >= 300) {
      emitCounter(events, 'stress.realtime.ticket_failure', 1);
      throw new Error(`Realtime ticket issue failed with HTTP ${statusCode || 'unknown'}.`);
    }

    const body = parseResponseBody(response && response.body);
    const ticket = body && typeof body.ticket === 'string' ? body.ticket : null;
    if (!ticket) {
      emitCounter(events, 'stress.realtime.ticket_failure', 1);
      throw new Error('Realtime ticket issue response did not contain ticket.');
    }

    context.vars.realtimeTicket = ticket;
    emitCounter(events, 'stress.realtime.ticket_issued', 1);
    emitHistogram(
      events,
      'stress.realtime.ticket_issue_ms',
      elapsedSince(context.vars.ticketIssueStartedAt),
    );
    finish(done);
  } catch (error) {
    finish(done, error);
  }
}

function recordRealtimeSubscribeAttempt(context, events, done) {
  emitCounter(events, 'stress.realtime.subscribe_attempt', 1);
  context.vars.subscribeStartedAt = Date.now();
  finish(done);
}

function emitRealtimeSubscribe(context, events, done) {
  emitRealtimeThreadAction(
    {
      context,
      events,
      eventName: 'chat.thread.subscribe',
      attemptMetric: 'stress.realtime.subscribe_attempt',
      ackMetric: 'stress.realtime.subscribe_ack',
      ackLatencyMetric: 'stress.realtime.subscribe_ack_ms',
      failureMetric: 'stress.realtime.subscribe_failure',
      startedAtVar: 'subscribeStartedAt',
    },
    done,
  );
}

function recordRealtimeSubscribeAck(context, events, done) {
  emitCounter(events, 'stress.realtime.subscribe_ack', 1);
  emitHistogram(
    events,
    'stress.realtime.subscribe_ack_ms',
    elapsedSince(context.vars.subscribeStartedAt),
  );
  finish(done);
}

function recordRealtimeUnsubscribeAttempt(context, events, done) {
  emitCounter(events, 'stress.realtime.unsubscribe_attempt', 1);
  finish(done);
}

function emitRealtimeUnsubscribe(context, events, done) {
  emitRealtimeThreadAction(
    {
      context,
      events,
      eventName: 'chat.thread.unsubscribe',
      attemptMetric: 'stress.realtime.unsubscribe_attempt',
      ackMetric: 'stress.realtime.unsubscribe_ack',
      ackLatencyMetric: 'stress.realtime.unsubscribe_ack_ms',
      failureMetric: 'stress.realtime.unsubscribe_failure',
      startedAtVar: 'unsubscribeStartedAt',
    },
    done,
  );
}

function recordRealtimeDisconnect(context, events, done) {
  emitCounter(events, 'stress.realtime.disconnect', 1);
  finish(done);
}

function buildSafeRealtimeLog(value) {
  return redact(value);
}

function parseResponseBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === 'object') {
    return body;
  }

  try {
    return JSON.parse(String(body));
  } catch {
    return null;
  }
}

function readContextVar(context, key) {
  const value = context && context.vars ? context.vars[key] : undefined;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  const envFallback = {
    threadId: process.env.STRESS_REALTIME_THREAD_ID,
    realtimeTicket: process.env.STRESS_REALTIME_TICKET,
  }[key];
  return typeof envFallback === 'string' && envFallback.trim().length > 0
    ? envFallback.trim()
    : null;
}

function elapsedSince(startedAt) {
  return typeof startedAt === 'number' && Number.isFinite(startedAt)
    ? Math.max(0, Date.now() - startedAt)
    : 0;
}

function emitRealtimeThreadAction(options, done) {
  try {
    const socket = readContextSocket(options.context);
    const threadId = readContextVar(options.context, 'threadId');
    if (!socket || typeof socket.emit !== 'function') {
      throw new Error('Realtime stress context is missing an active Socket.IO socket.');
    }

    if (!threadId) {
      throw new Error('Realtime stress thread action requires threadId.');
    }

    const startedAt = Date.now();
    options.context.vars[options.startedAtVar] = startedAt;
    emitCounter(options.events, 'socketio.emit', 1);
    emitRate(options.events, 'socketio.emit_rate');
    emitCounter(options.events, options.attemptMetric, 1);

    const ackCallback = (error, response) => {
      if (error) {
        emitCounter(options.events, options.failureMetric, 1);
        emitCounter(
          options.events,
          `${options.failureMetric}.${sanitizeMetricSegment(error.message || String(error))}`,
          1,
        );
        finish(done, error instanceof Error ? error : new Error(String(error)));
        return;
      }

      if (!response || response.ok !== true) {
        emitCounter(options.events, options.failureMetric, 1);
        emitCounter(
          options.events,
          `${options.failureMetric}.${sanitizeMetricSegment(response?.reason || 'unknown')}`,
          1,
        );
        finish(
          done,
          new Error(
            `Realtime ${options.eventName} ack failed with reason ${response?.reason || 'unknown'}.`,
          ),
        );
        return;
      }

      emitCounter(options.events, options.ackMetric, 1);
      emitHistogram(options.events, options.ackLatencyMetric, elapsedSince(startedAt));
      finish(done);
    };

    const socketWithTimeout =
      typeof socket.timeout === 'function' ? socket.timeout(readAckTimeoutMs()) : socket;

    socketWithTimeout.emit(options.eventName, { threadId }, ackCallback);
  } catch (error) {
    finish(done, error);
  }
}

function readContextSocket(context) {
  return context?.sockets?.[''] || context?.sockets?.['/chat'] || null;
}

function readAckTimeoutMs() {
  const parsed = Number.parseInt(process.env.STRESS_ARTILLERY_ACK_TIMEOUT_MS || '3000', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
}

function sanitizeMetricSegment(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 80);
}

function emitCounter(events, name, value) {
  if (events && typeof events.emit === 'function') {
    events.emit('counter', name, value);
  }
}

function emitRate(events, name) {
  if (events && typeof events.emit === 'function') {
    events.emit('rate', name);
  }
}

function emitHistogram(events, name, value) {
  if (events && typeof events.emit === 'function') {
    events.emit('histogram', name, value);
  }
}

function finish(done, error) {
  if (typeof done === 'function') {
    done(error || null);
    return;
  }

  if (error) {
    throw error;
  }
}

function redact(value, key) {
  if (
    key &&
    /(?:email|password|passphrase|token|ticket|secret|cookie|authorization|session)/iu.test(key)
  ) {
    return REDACTED_STRESS_SECRET;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, REDACTED_STRESS_SECRET)
      .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/giu, REDACTED_STRESS_SECRET)
      .replace(/\b(?:session|refresh|access|token|jwt|sid)=([^;\s]+)/giu, (match) =>
        match.replace(/=.*/u, `=${REDACTED_STRESS_SECRET}`),
      );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }

  return REDACTED_STRESS_SECRET;
}

module.exports = {
  validateRealtimeScenario,
  setRealtimeTicketRequest,
  captureRealtimeTicketResponse,
  recordRealtimeSubscribeAttempt,
  emitRealtimeSubscribe,
  recordRealtimeSubscribeAck,
  recordRealtimeUnsubscribeAttempt,
  emitRealtimeUnsubscribe,
  recordRealtimeDisconnect,
  buildSafeRealtimeLog,
};
