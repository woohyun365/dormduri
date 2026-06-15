'use strict';

const REDACTED_STRESS_SECRET = '[REDACTED_STRESS_SECRET]';

function validateRealtimeScenario(context, events, done) {
  try {
    const accessToken = readContextVar(context, 'accessToken');
    const threadId = readContextVar(context, 'threadId');
    const actorId = readContextVar(context, 'actorId') || 'unknown-actor';

    if (!accessToken) {
      throw new Error('Realtime stress actor row is missing accessToken.');
    }

    if (!threadId) {
      throw new Error('Realtime stress actor row is missing threadId.');
    }

    context.vars.actorId = actorId;
    context.vars.realtimeTicket = null;
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
      'User-Agent': 'knu-roommate-artillery-realtime-stress',
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
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function elapsedSince(startedAt) {
  return typeof startedAt === 'number' && Number.isFinite(startedAt)
    ? Math.max(0, Date.now() - startedAt)
    : 0;
}

function emitCounter(events, name, value) {
  if (events && typeof events.emit === 'function') {
    events.emit('counter', name, value);
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
  recordRealtimeSubscribeAck,
  recordRealtimeUnsubscribeAttempt,
  recordRealtimeDisconnect,
  buildSafeRealtimeLog,
};
