import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_THREAD_LIFECYCLE_EVENT_METADATA_FORBIDDEN_KEYS,
  ConversationThreadLifecycleEventMetadataPolicyError,
  toConversationThreadLifecycleEventMetadata,
} from './conversation-thread-lifecycle-event.payload.policy.js';

describe('conversation thread lifecycle event payload policy guard', () => {
  it('rejects raw or sensitive metadata keys from lifecycle event payloads', () => {
    for (const forbiddenKey of CONVERSATION_THREAD_LIFECYCLE_EVENT_METADATA_FORBIDDEN_KEYS) {
      expect(() =>
        toConversationThreadLifecycleEventMetadata({ [forbiddenKey]: 'sensitive' }),
      ).toThrow(ConversationThreadLifecycleEventMetadataPolicyError);
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
    const allowedMetadata = {
      sourceActiveMatchId: 'match-1',
      sourceMatchRequestId: 'request-1',
      sourceUnmatchRequestId: 'unmatch-1',
      sourceBlockId: 'block-1',
      sourceReportCaseId: 'report-1',
      sourceArchiveJobId: 'archive-1',
      previousStatus: 'OPEN',
      nextStatus: 'READ_ONLY',
      previousThreadKind: 'DIRECT',
      nextThreadKind: 'DIRECT',
      previousClosedReason: null,
      nextClosedReason: 'USER_BLOCKED',
    };

    expect(toConversationThreadLifecycleEventMetadata(allowedMetadata)).toEqual(allowedMetadata);
  });
});
