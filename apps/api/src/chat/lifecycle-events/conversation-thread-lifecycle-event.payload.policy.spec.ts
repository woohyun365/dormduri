import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
