import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { discoverScriptTests } from './repo-policy-test-files.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const corpus = JSON.parse(read('scripts/ci/fixtures/agent-collaboration-cases.json'));
const workflow = 'docs/development/agent-workflows/';
const categories = new Set([
  'direct',
  'decision',
  'consultation',
  'delegation',
  'peer',
  'qa',
  'evidence',
]);
const actions = {
  answer: 'answer',
  analyze: 'produce-analysis',
  implement: 'mutate',
  review: 'inspect',
};
const dispositions = new Set([
  'execute',
  'recommend',
  'await-owner',
  'inspect',
  'delegate',
  'answer',
  'handoff',
  'review',
  'blocked-check',
  'report-gap',
]);

// Fixture consistency only. This does not classify prompts, dispatch tools or evaluate an agent's prose.
function validateCorpus(value) {
  assert.equal(value.schemaVersion, 1);
  assert.match(value.corpusVersion, /^\d+\.\d+\.\d+$/u);
  assert.ok(Array.isArray(value.cases) && value.cases.length > 0);
  const ids = new Set();
  for (const item of value.cases) {
    assert.match(item.id, /^[a-z]+(?:-[a-z]+)*$/u);
    assert.ok(!ids.has(item.id), `duplicate ${item.id}`);
    ids.add(item.id);
    assert.ok(Object.hasOwn(actions, item.intent), item.id);
    assert.equal(item.authority, actions[item.intent], item.id);
    assert.ok(categories.has(item.category), item.id);
    assert.ok(typeof item.scenario === 'string' && item.scenario.trim().length > 0);
    for (const field of ['requiredSignals', 'prohibitedActions']) {
      assert.ok(Array.isArray(item[field]) && item[field].length > 0, item.id);
      assert.ok(item[field].every((signal) => typeof signal === 'string' && signal.length > 0));
      assert.equal(new Set(item[field]).size, item[field].length);
    }
    assert.ok(
      !item.requiredSignals.some((signal) => item.prohibitedActions.includes(signal)),
      item.id,
    );
    assert.ok(dispositions.has(item.expected.disposition), item.id);
    assert.ok(
      ['none', 'no-contact', 'exchange', 'after-assessment'].includes(item.expected.peerAction),
    );
    if (item.expected.disposition === 'execute') assert.equal(item.authority, 'mutate');
    if (['exchange', 'after-assessment'].includes(item.expected.peerAction)) {
      const channel = item.communication;
      assert.equal(channel?.designation, 'parent-designated');
      assert.equal(channel.snapshot, 'current');
      assert.equal(channel.participants.length, 2);
      assert.equal(new Set(channel.participants).size, 2);
      assert.ok(
        channel.participants.every(
          (participant) => typeof participant === 'string' && participant.length > 0,
        ),
      );
      assert.ok(typeof channel.topic === 'string' && channel.topic.length > 0);
      assert.ok(
        channel.readScope.length > 0 &&
          channel.readScope.every((path) => typeof path === 'string' && path.length > 0),
      );
      assert.equal(
        channel.qaStage,
        item.expected.peerAction === 'exchange' ? 'not-qa' : 'initial-then-recorded',
      );
    }
  }
}

test('finite collaboration corpus has canonical authority and noncontradictory expectations', () => {
  validateCorpus(corpus);
  assert.deepEqual(new Set(corpus.cases.map(({ category }) => category)), categories);
  for (const peerAction of ['exchange', 'no-contact', 'after-assessment']) {
    assert.ok(corpus.cases.some((item) => item.expected.peerAction === peerAction));
  }
  const signals = new Set(corpus.cases.flatMap((item) => item.requiredSignals));
  for (const signal of [
    'direct-work',
    'keep-option',
    'owner-choice',
    'selective-concern',
    'parent-integration',
    'parent-summary',
    'initial-independent-assessment',
    'runner-gap',
    'content-style-separation',
    'source-revalidation',
  ])
    assert.ok(signals.has(signal), signal);
  const forbidden = new Set(corpus.cases.flatMap((item) => item.prohibitedActions));
  for (const action of [
    'nested-spawn',
    'indirect-delegation',
    'task-offload',
    'unauthorized-contact',
    'builder-leading',
    'unapproved-spend',
    'routine-reapproval',
  ])
    assert.ok(forbidden.has(action), action);
  const variants = new Set(
    corpus.cases.flatMap((item) => item.communication?.denialVariants ?? []),
  );
  for (const reason of [
    'absent',
    'wrong-recipient',
    'wrong-topic',
    'source-changed',
    'completed',
    'withdrawn',
  ])
    assert.ok(variants.has(reason), reason);
});

test('invalid fixture mutations are rejected rather than treated as behavior evidence', () => {
  const mutations = [
    (v) => {
      v.cases.push(structuredClone(v.cases[0]));
    },
    (v) => {
      v.cases[0].intent = 'lookup';
    },
    (v) => {
      v.cases.find((c) => c.intent === 'analyze').authority = 'mutate';
    },
    (v) => {
      v.cases[0].prohibitedActions.push(v.cases[0].requiredSignals[0]);
    },
    (v) => {
      v.cases.find((c) => c.expected.peerAction === 'exchange').communication.designation =
        'absent';
    },
    (v) => {
      v.cases.find((c) => c.expected.peerAction === 'exchange').communication.snapshot = 'expired';
    },
    (v) => {
      v.cases.find((c) => c.expected.peerAction === 'after-assessment').expected.peerAction =
        'exchange';
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(corpus);
    mutate(invalid);
    assert.throws(() => validateCorpus(invalid));
  }
});

test('common collaboration owner is discoverable without duplicating its protocol', () => {
  for (const path of [
    'AGENTS.md',
    'README.md',
    ...[
      'README.md',
      'agent-execution-contract.md',
      'getting-started.md',
      'orchestration.md',
      'request-intake/delegation.md',
      'request-intake/context-pack.md',
      'request-intake/output-contracts.md',
      'plan-authoring/core.md',
    ].map((p) => workflow + p),
  ]) {
    assert.match(read(path), /owner-lead-collaboration\.md/u, path);
  }
  const common = read(workflow + 'owner-lead-collaboration.md');
  assert.match(common, /\.\/qa\.md/u);
  assert.match(common, /\.\/development-lifecycle\.md/u);
  assert.doesNotMatch(common, /\.omx\/plans\/|\bPhase\s+\d/u);
  assert.ok(discoverScriptTests(root).includes('scripts/ci/agent-collaboration-contract.test.mjs'));
});
