// Codex review registry fixture for the ledger reader tests: one Parent session with review rounds 1 and 2 accepted
// (their results and dispositions are in the plan evidence, as the Parent saves them), round 3 registered and never
// accepted, a lane task that is no review, a registration that cannot be read, and a round 1 criteria record.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

export const DIGEST = `sha256:${'a'.repeat(64)}`;
export const SESSION = '01a124c1-ca31-7533-9568-76dd35726310';
const registration = (round, accepted = true) => ({
  schema: 'knu-codex-task-registration/v1',
  sessionId: SESSION,
  taskName: `review_tok1_${round}`,
  kind: 'review',
  reviewId: `review-tok1-${round}`,
  dispatchToken: 'tok1',
  round,
  reviewOf: ['lane-a'],
  spawnArguments: {
    task_name: `review_tok1_${round}`,
    agent_type: 'knu_reviewer',
    model: 'gpt-6-astra',
    reasoning_effort: 'xhigh',
    fork_turns: 'none',
  },
  accepted,
});
const snapshot = (head) => ({
  baseSHA: head,
  headSHA: head,
  dirtyDiffDigest: null,
  untrackedInputDigests: [],
});
const result = (verdict, findings, head) => ({
  schemaVersion: 'cross-model-handoff/v1',
  packetId: 'review-tok1',
  status: 'complete',
  reviewedSnapshot: snapshot(head),
  verdict,
  findings,
  acceptanceCoverage: [],
});
const finding = {
  severity: 'medium',
  location: 'a.mjs:1',
  impact: 'i',
  reproduction: 'r',
  evidence: 'e',
  criteriaItem: 'documents.md D2',
};

// Builds the fixture in a new temporary directory and pushes it to `temporary` for the caller to remove.
export function codexReviewRegistry(temporary) {
  const root = mkdtempSync(resolve(tmpdir(), 'codex-review-ledger-'));
  temporary.push(root);
  const write = (path, value) => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  const registry = `.artifacts/tools/codex-native/${SESSION}`;
  for (const round of [1, 2, 3]) {
    const { accepted, ...record } = registration(round, round < 3);
    write(`${registry}/review_tok1_${round}.json`, record);
    if (accepted)
      write(`${registry}/review_tok1_${round}.accepted.json`, {
        schema: 'knu-codex-task-acceptance/v1',
        sessionId: SESSION,
        taskName: `review_tok1_${round}`,
        kind: 'review',
        agentId: `agent-${round}`,
        stopDigest: DIGEST,
        registrationDigest: DIGEST,
        acceptedAt: `2026-10-10T0${round}:00:00.000Z`,
      });
  }
  write(`${registry}/lane_x.json`, { ...registration(1), kind: 'lane', taskName: 'lane_x' });
  write(`${registry}/broken.json`, '{ "schema": ');
  write(`${registry}/review-tok1-1.criteria.json`, {
    schema: 'review-criteria-selection/v1',
    paths: ['a.mjs', 'docs/b.md'],
    documents: [],
    documentCount: 1,
    itemCount: 0,
  });
  write('evidence/r1-result.json', result('FAIL', [finding], 'a'.repeat(40)));
  write('evidence/r1-adjudication.json', {
    schema: 'review-adjudication/v1',
    subject: 'codex-feature',
    round: 1,
    reviews: [{ taskId: 'review_tok1_1', resultPath: 'evidence/r1-result.json' }],
    findings: [{ id: 'review_tok1_1#0', severity: 'medium', disposition: 'fixed', fixRef: DIGEST }],
  });
  write('evidence/r2-result.json', result('PASS', [], 'b'.repeat(40)));
  write('evidence/r2-adjudication.json', {
    schema: 'review-adjudication/v1',
    subject: 'codex-feature',
    round: 2,
    reviews: [{ taskId: 'review_tok1_2', resultPath: 'evidence/r2-result.json' }],
    findings: [],
  });
  return root;
}
