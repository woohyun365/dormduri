import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConversationThreadLifecycleEventMetadataPolicyError,
  toConversationThreadLifecycleEventMetadata,
} from './conversation-thread-lifecycle-event.payload.policy.js';

const apiRoot = process.cwd();
const payloadPolicyPath = join(
  apiRoot,
  'src/chat/lifecycle-events/conversation-thread-lifecycle-event.payload.policy.ts',
);

function readPayloadPolicySource() {
  return existsSync(payloadPolicyPath) ? readFileSync(payloadPolicyPath, 'utf8') : '';
}

describe('conversation thread lifecycle event payload policy guard', () => {
  it('keeps lifecycle event metadata policy in the chat lifecycle-events owner', () => {
    expect(existsSync(payloadPolicyPath)).toBe(true);
  });

  it('rejects raw or sensitive metadata keys from lifecycle event payloads', () => {
    const source = readPayloadPolicySource();
    const forbiddenKeys = [
      'messageBody',
      'body',
      'retainedBody',
      'vaultPayload',
      'reportDetail',
      'blockNote',
      'supportBody',
      'token',
      'credential',
      'stack',
      'prismaError',
      'internalAuditPayload',
    ];

    for (const forbiddenKey of forbiddenKeys) {
      expect(source).toContain(forbiddenKey);
    }
  });

  it('returns sanitized scalar metadata and omits empty input', () => {
    expect(toConversationThreadLifecycleEventMetadata(null)).toBeUndefined();
    expect(toConversationThreadLifecycleEventMetadata({})).toBeUndefined();
    expect(
      toConversationThreadLifecycleEventMetadata({
        sourceBlockId: 'block-1',
        previousStatus: 'OPEN',
        nextStatus: 'READ_ONLY',
        nextClosedReason: null,
      }),
    ).toEqual({
      sourceBlockId: 'block-1',
      previousStatus: 'OPEN',
      nextStatus: 'READ_ONLY',
      nextClosedReason: null,
    });
  });

  it('rejects nested forbidden keys, undefined, non-finite numbers, and nested objects', () => {
    const invalidMetadataList = [
      { previousStatus: 'OPEN', nested: { messageBody: 'raw text' } },
      { previousStatus: undefined },
      { previousStatus: Number.POSITIVE_INFINITY },
      { previousStatus: { value: 'OPEN' } },
    ];

    for (const invalidMetadata of invalidMetadataList) {
      expect(() => toConversationThreadLifecycleEventMetadata(invalidMetadata)).toThrow(
        ConversationThreadLifecycleEventMetadataPolicyError,
      );
    }
  });

  it('keeps source pointer and state-transition keys on an explicit allowlist', () => {
    const source = readPayloadPolicySource();
    const allowedPointerKeys = [
      'sourceActiveMatchId',
      'sourceMatchRequestId',
      'sourceUnmatchRequestId',
      'sourceBlockId',
      'sourceReportCaseId',
      'sourceArchiveJobId',
      'previousStatus',
      'nextStatus',
      'previousThreadKind',
      'nextThreadKind',
      'previousClosedReason',
      'nextClosedReason',
    ];

    for (const allowedPointerKey of allowedPointerKeys) {
      expect(source).toContain(allowedPointerKey);
    }
  });
});
