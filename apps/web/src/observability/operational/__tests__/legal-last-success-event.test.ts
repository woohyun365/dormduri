import { afterEach, describe, expect, it } from 'vitest';
import { createOperationalEventEnvelope } from '../operational-context';
import type { OperationalEvent, WebLegalLastSuccessEvent } from '../operational-events';
import { sanitizeOperationalEvent } from '../sanitize-operational-event';
import {
  recordServerOperationalEvent,
  setServerOperationalEventWriterForTests,
} from '../server-runtime';

const envelope = createOperationalEventEnvelope({
  pathname: '/privacy',
  environment: 'production',
  release: 'web-test',
  occurredAt: '2026-11-26T01:00:00.000Z',
});

// One structured line per request the Web answered from its last success (kind, version key, checked time;
// no personal data), and one when it could not keep a response.
const served = {
  ...envelope,
  eventName: 'web_legal_last_success',
  action: 'served',
  endpoint: 'page',
  documentKind: 'PRIVACY_POLICY',
  versionKey: 'current',
  checkedAt: '2026-11-25T09:30:00.000Z',
};
const writeFailed = {
  ...envelope,
  eventName: 'web_legal_last_success',
  action: 'write_failed',
  endpoint: 'revision-notices',
  documentKind: 'all',
  versionKey: 'all',
};

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe('web legal last success event', () => {
  it('keeps the served and write failure lines', () => {
    expect(sanitizeOperationalEvent(served)).toEqual(served);
    expect(sanitizeOperationalEvent(writeFailed)).toEqual(writeFailed);
    expect(
      sanitizeOperationalEvent({ ...served, endpoint: 'comparison', versionKey: '2026-11-20' }),
    ).not.toBeNull();
  });

  it.each([
    ['an unknown action', { action: 'deleted' }],
    ['an unknown endpoint', { endpoint: 'active' }],
    ['an unknown kind', { documentKind: 'COOKIE_POLICY' }],
    ['a version key that is not a date', { versionKey: '../current' }],
    ['a served line without its checked time', { checkedAt: undefined }],
    ['a checked time that is not ISO', { checkedAt: 'yesterday' }],
    ['a request body field', { body: '본문' }],
  ])('drops %s', (_label, change) => {
    expect(sanitizeOperationalEvent({ ...served, ...change })).toBeNull();
  });

  it('writes the line as a web_operational log', () => {
    const lines: OperationalEvent[] = [];
    restore = setServerOperationalEventWriterForTests((event) => {
      lines.push(event);
    });

    recordServerOperationalEvent(served as WebLegalLastSuccessEvent);

    expect(lines).toEqual([served]);
  });
});
