import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { buildTaskEnvelope, validateCrossModelExchange } from '../../../agents/common/index.mjs';
import {
  CLAUDE_ADAPTER_READINESS,
  assessClaudeStaticExchange,
  assessClaudeModelObservation,
  assessClaudeSubagentAdmission,
  createClaudeSubagentBinding,
  evaluateClaudeProfileEligibility,
  listClaudeSubagentProfiles,
} from '../../../agents/claude/index.mjs';
import * as policy from '../../../agents/claude/model-policy.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const snapshotDigest = `sha256:${'1'.repeat(64)}`;
const configDigest = `sha256:${'2'.repeat(64)}`;
const now = '2026-09-26T12:00:00.000Z';
const roles = {
  knu_explorer: ['Read', 'Grep', 'Glob'],
  knu_explorer_xhigh: ['Read', 'Grep', 'Glob'],
  knu_researcher: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
  knu_executor: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  knu_executor_xhigh: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  knu_reviewer: ['Read', 'Grep', 'Glob'],
};

function facts(...keys) {
  return keys.map((key) => ({
    key,
    sourceRef: 'docs/development/agent-workflows/qa.md',
    confidence: 'high',
  }));
}

function digestObject(value) {
  const canonical = (item) =>
    Array.isArray(item)
      ? item.map(canonical)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, canonical(item[key])]),
          )
        : item;
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')}`;
}

function inputFor(profileId = 'bounded-standard', kind = 'build') {
  const envelope = buildTaskEnvelope({
    request: 'scripts/agents/claude 계약을 구현해줘.',
  });
  const task = {
    taskId: 'task-h3m-001',
    kind,
    impactRisk: 'medium',
    complexity: 'bounded',
    uncertainty: 'resolved',
    role: kind === 'build' ? 'knu_executor' : kind === 'review' ? 'knu_reviewer' : 'knu_explorer',
    allowedTools: [
      ...roles[
        kind === 'build' ? 'knu_executor' : kind === 'review' ? 'knu_reviewer' : 'knu_explorer'
      ],
    ],
    readScope: ['scripts/agents/claude'],
    writeScope: kind === 'build' ? ['scripts/agents/claude'] : [],
    writeOwner: kind === 'build' ? 'executor-h3m' : null,
    childValue: 'independent-verification',
    independent: true,
    knownGaps: [],
    facts: facts(
      'source-bound',
      'bounded-scope',
      'acceptance',
      'oracle',
      'independent-qa',
      'regression',
      'one-writer',
    ),
  };
  if (profileId === 'bounded-extraction') {
    task.kind = 'extract';
    task.impactRisk = 'low';
    task.role = 'knu_explorer_xhigh';
    task.allowedTools = [...roles.knu_explorer_xhigh];
    task.writeScope = [];
    task.writeOwner = null;
    task.facts = facts(
      'source-bound',
      'fixed-input',
      'single-step',
      'output-schema',
      'acceptance',
      'independent-check',
    );
  }
  if (kind === 'read' && profileId === 'bounded-standard') {
    task.facts = facts('source-bound', 'bounded-scope', 'acceptance', 'oracle', 'independent-qa');
  }
  if (profileId === 'complex-critical') {
    task.kind = 'review';
    task.impactRisk = 'high';
    task.complexity = 'complex';
    task.role = 'knu_reviewer';
    task.allowedTools = [...roles.knu_reviewer];
    task.writeScope = [];
    task.writeOwner = null;
    task.facts = facts(
      'source-bound',
      'bounded-scope',
      'acceptance',
      'oracle',
      'independent-qa',
      'fresh-context',
    );
  }
  return {
    envelope,
    profileId,
    selectedBy: 'lead',
    selectionBasisRef: 'docs/development/agent-workflows/qa.md',
    task,
    sourceDigest: snapshotDigest,
    configDigest,
    issuedAt: '2026-09-26T11:55:00.000Z',
    expiresAt: '2026-09-26T12:25:00.000Z',
  };
}

function admitted(binding) {
  return {
    bindingDigest: binding.bindingDigest,
    taskId: binding.taskId,
    sourceDigest: binding.sourceDigest,
    configDigest: binding.configDigest,
    scopeDigest: binding.scopeDigest,
    envelopeDigest: binding.envelopeDigest,
    approvedBy: 'lead',
    authorityRef: 'current-owner-request',
    permission: 'allowed',
    qaOwner: 'independent-reviewer',
    issuedAt: '2026-09-26T11:56:00.000Z',
    expiresAt: '2026-09-26T12:20:00.000Z',
  };
}

function reportedRuntime(binding) {
  return {
    support: 'supported',
    permission: 'allowed',
    quota: 'available',
    freshness: 'current-turn',
    role: binding.role,
    roleTools: roles[binding.role],
    requestedAlias: binding.requestedModelAlias,
    expectedResolvedModel: `claude-${binding.requestedModelAlias}-synthetic`,
    evidenceRef: 'fixture:reported-current-turn',
  };
}

function candidate(input = inputFor()) {
  const binding = createClaudeSubagentBinding(input);
  const admission = admitted(binding);
  const runtime = reportedRuntime(binding);
  const result = assessClaudeSubagentAdmission({
    binding,
    admission,
    runtime,
    current: {
      requestId: input.envelope.requestId,
      taskId: input.task.taskId,
      sourceDigest: input.sourceDigest,
      configDigest: input.configDigest,
      scopeDigest: binding.scopeDigest,
      envelopeDigest: binding.envelopeDigest,
      writerInventory: { status: 'current-turn', evidenceRef: 'fixture:writer-state', active: [] },
      now,
    },
  });
  return { binding, admission, runtime, result };
}

test('finite Claude profiles are lead-selected task candidates, never role pins or live admission', () => {
  const profiles = listClaudeSubagentProfiles();
  assert.deepEqual(
    profiles.map(({ id, modelAlias }) => [id, modelAlias]),
    [
      ['bounded-extraction', 'haiku'],
      ['bounded-standard', 'sonnet'],
      ['complex-critical', 'opus'],
    ],
  );
  assert.equal(Object.isFrozen(profiles), true);
  assert.deepEqual(CLAUDE_ADAPTER_READINESS, {
    host: 'claude-code',
    admission: 'mode-specific',
    mode: 'interactive-auto',
    enforcement: 'healthy-hook-request-check',
    runtimeSupport: 'per-run-observation-required',
    applied: false,
  });
  for (const profile of profiles) assert.equal(Object.isFrozen(profile), true);
});

test('eligibility rejects low-model downgrade, role/tool mismatch and child-free work', () => {
  const valid = inputFor('bounded-standard', 'build');
  assert.equal(evaluateClaudeProfileEligibility(valid).eligible, true);
  for (const mutate of [
    (x) => {
      x.task.impactRisk = 'high';
    },
    (x) => {
      x.task.complexity = 'complex';
    },
    (x) => {
      x.task.uncertainty = 'uncertain';
    },
    (x) => {
      x.task.role = 'knu_reviewer';
    },
    (x) => {
      x.task.writeOwner = null;
    },
    (x) => {
      x.task.childValue = 'none';
    },
    (x) => {
      x.task.independent = false;
    },
    (x) => {
      x.task.knownGaps = ['missing oracle'];
    },
    (x) => {
      x.task.facts = x.task.facts.filter(({ key }) => key !== 'regression');
    },
    (x) => {
      x.task.facts[0].confidence = 'low';
    },
  ]) {
    const input = structuredClone(valid);
    mutate(input);
    assert.equal(
      evaluateClaudeProfileEligibility(input).eligible,
      false,
      JSON.stringify(input.task),
    );
  }
  const read = inputFor('bounded-standard', 'read');
  read.task.writeScope = [];
  read.task.writeOwner = null;
  read.task.allowedTools = ['Read', 'Bash'];
  assert.equal(evaluateClaudeProfileEligibility(read).eligible, false);
  const malformed = inputFor();
  malformed.task.facts = [null];
  assert.doesNotThrow(() => evaluateClaudeProfileEligibility(malformed));
  assert.equal(evaluateClaudeProfileEligibility(malformed).eligible, false);
  const understatedBuild = inputFor();
  understatedBuild.task.allowedTools = understatedBuild.task.allowedTools.filter(
    (tool) => tool !== 'Bash',
  );
  assert.equal(evaluateClaudeProfileEligibility(understatedBuild).eligible, false);
});

test('neutral intake authority and risk cannot be expanded or downgraded', () => {
  const analysis = inputFor();
  analysis.envelope = buildTaskEnvelope({ request: '현재 코드를 분석해줘.' });
  assert.equal(analysis.envelope.authorizedAction, 'produce-analysis');
  assert.equal(evaluateClaudeProfileEligibility(analysis).eligible, false);
  const risky = inputFor('bounded-extraction');
  risky.envelope = buildTaskEnvelope({ request: '보안 로그를 분석해줘.' });
  assert.equal(risky.envelope.risk, 'high');
  assert.equal(evaluateClaudeProfileEligibility(risky).eligible, false);
  const safeExtraction = inputFor('bounded-extraction');
  safeExtraction.envelope = buildTaskEnvelope({ request: '현재 코드를 분석해줘.' });
  assert.equal(evaluateClaudeProfileEligibility(safeExtraction).eligible, true);
});

test('Opus baseline covers bounded complex/high-risk/uncertain tasks, not only review', () => {
  const highRiskBuild = inputFor('bounded-standard', 'build');
  highRiskBuild.profileId = 'complex-critical';
  highRiskBuild.task.impactRisk = 'high';
  highRiskBuild.task.complexity = 'complex';
  highRiskBuild.task.role = 'knu_executor_xhigh';
  assert.equal(evaluateClaudeProfileEligibility(highRiskBuild).eligible, true);
  assert.equal(createClaudeSubagentBinding(highRiskBuild).requestedModelAlias, 'opus');

  const uncertainRead = inputFor('bounded-standard', 'read');
  uncertainRead.profileId = 'complex-critical';
  uncertainRead.task.uncertainty = 'uncertain';
  assert.equal(evaluateClaudeProfileEligibility(uncertainRead).eligible, true);
  assert.equal(createClaudeSubagentBinding(uncertainRead).requestedModelAlias, 'opus');

  const ordinaryRead = inputFor('bounded-standard', 'read');
  assert.equal(evaluateClaudeProfileEligibility(ordinaryRead).eligible, true);
  ordinaryRead.task.impactRisk = 'high';
  assert.equal(evaluateClaudeProfileEligibility(ordinaryRead).eligible, false);

  const verifiedBuild = inputFor('bounded-standard', 'build');
  assert.ok(verifiedBuild.task.allowedTools.includes('Bash'));
  assert.equal(evaluateClaudeProfileEligibility(verifiedBuild).eligible, true);
});

// Effort comes from the role file, so the policy picks the effort tier through the executor role.
function executorBuild(profileId, impactRisk, complexity, role) {
  const input = inputFor('bounded-standard', 'build');
  input.profileId = profileId;
  Object.assign(input.task, { impactRisk, complexity, role, allowedTools: [...roles[role]] });
  return evaluateClaudeProfileEligibility(input);
}

test('high-risk builds require the xhigh executor and the variant stays an Opus build role', () => {
  const tier = (...args) => executorBuild(...args).reasons;
  assert.deepEqual(tier('complex-critical', 'high', 'complex', 'knu_executor_xhigh'), []);
  assert.deepEqual(tier('complex-critical', 'high', 'bounded', 'knu_executor_xhigh'), []);
  assert.deepEqual(tier('complex-critical', 'high', 'complex', 'knu_executor'), ['effort-tier']);
  // Recovery may escalate a non-high-risk complex build from Opus high to Opus xhigh.
  assert.deepEqual(tier('complex-critical', 'medium', 'complex', 'knu_executor_xhigh'), []);
  assert.deepEqual(tier('complex-critical', 'medium', 'complex', 'knu_executor'), []);
  assert.ok(
    tier('bounded-standard', 'medium', 'bounded', 'knu_executor_xhigh').includes('effort-tier'),
  );
  assert.deepEqual(tier('bounded-standard', 'medium', 'bounded', 'knu_executor'), []);

  const read = inputFor('bounded-standard', 'read');
  read.profileId = 'complex-critical';
  read.task.uncertainty = 'uncertain';
  Object.assign(read.task, {
    role: 'knu_executor_xhigh',
    allowedTools: [...roles.knu_executor_xhigh],
  });
  assert.ok(evaluateClaudeProfileEligibility(read).reasons.includes('effort-tier'));

  const unowned = inputFor('bounded-standard', 'build');
  unowned.profileId = 'complex-critical';
  Object.assign(unowned.task, {
    impactRisk: 'high',
    role: 'knu_executor_xhigh',
    writeScope: [],
    writeOwner: null,
  });
  assert.ok(evaluateClaudeProfileEligibility(unowned).reasons.includes('write-owner'));
});

test('Sonnet bounded-standard admits the same fixed extraction as the Haiku profile', () => {
  const extraction = inputFor('bounded-extraction');
  extraction.envelope = buildTaskEnvelope({ request: '현재 코드를 분석해줘.' });
  extraction.profileId = 'bounded-standard';
  extraction.task.role = 'knu_explorer';
  assert.deepEqual(evaluateClaudeProfileEligibility(extraction), { eligible: true, reasons: [] });
  assert.equal(createClaudeSubagentBinding(extraction).requestedModelAlias, 'sonnet');
  const missing = structuredClone(extraction);
  missing.task.facts = missing.task.facts.filter(({ key }) => key !== 'independent-check');
  assert.ok(evaluateClaudeProfileEligibility(missing).reasons.includes('required-facts'));
});

// The capability table is the one place that knows which exact IDs lack effort. An ID it does not
// list supports effort and is compared with the role effort; a family prefix is not enough.
test('the capability table lists effortless exact IDs and holds any other ID to effort', () => {
  assert.equal(policy.claudeModelSupportsEffort('claude-haiku-synthetic-effort'), true);
  assert.equal(policy.claudeModelSupportsEffort('claude-sonnet-synthetic'), true);
  const table = policy.CLAUDE_MODEL_CAPABILITIES;
  assert.equal(Object.isFrozen(table), true);
  const effortless = Object.keys(table).filter((id) => table[id].effort === false);
  assert.ok(effortless.length > 0, 'the table lists an effortless exact ID');
  for (const id of effortless) {
    assert.equal(Object.isFrozen(table[id]), true, id);
    assert.equal(policy.claudeModelSupportsEffort(id), false, id);
    const sibling = id.replace(/-[^-]+$/u, '-synthetic');
    assert.equal(policy.claudeModelSupportsEffort(sibling), true, `${sibling}: same family`);
  }
});

// The xhigh explorer is the only extraction role. Outside a bound retry from bounded-extraction it
// is refused like the xhigh executor, and it never takes a repository read.
function explorerTask(profileId, role, kind = 'extract') {
  const input = inputFor('bounded-extraction');
  input.envelope = buildTaskEnvelope({ request: '현재 코드를 분석해줘.' });
  input.profileId = profileId;
  Object.assign(input.task, { kind, role, allowedTools: ['Read', 'Grep', 'Glob'] });
  if (kind === 'read')
    input.task.facts = facts(
      'source-bound',
      'bounded-scope',
      'acceptance',
      'oracle',
      'independent-qa',
    );
  return input;
}
const EXTRACTION_RETRY = {
  of: '00000000-0000-4000-8000-000000000002',
  cause: 'result-error',
  step: 1,
  fromProfileId: 'bounded-extraction',
  fromRole: 'knu_explorer_xhigh',
};

test('bounded-extraction takes only the xhigh explorer', () => {
  const reasons = (role) =>
    evaluateClaudeProfileEligibility(explorerTask('bounded-extraction', role)).reasons;
  assert.deepEqual(reasons('knu_explorer'), ['role']);
  assert.deepEqual(reasons('knu_explorer_xhigh'), []);
});

test('the xhigh explorer works in bounded-standard only as a bound extraction retry', () => {
  const standard = explorerTask('bounded-standard', 'knu_explorer_xhigh');
  assert.deepEqual(evaluateClaudeProfileEligibility(standard).reasons, ['effort-tier']);
  standard.task.recovery = EXTRACTION_RETRY;
  assert.deepEqual(evaluateClaudeProfileEligibility(standard).reasons, []);
  for (const recovery of [
    { ...EXTRACTION_RETRY, fromRole: 'knu_explorer' },
    { ...EXTRACTION_RETRY, fromProfileId: 'bounded-standard' },
  ]) {
    standard.task.recovery = recovery;
    assert.deepEqual(
      evaluateClaudeProfileEligibility(standard).reasons,
      ['effort-tier'],
      JSON.stringify(recovery),
    );
  }
  assert.deepEqual(
    evaluateClaudeProfileEligibility(explorerTask('bounded-standard', 'knu_explorer')).reasons,
    [],
  );
});

test('the xhigh explorer never takes a repository read', () => {
  const read = explorerTask('bounded-standard', 'knu_explorer_xhigh', 'read');
  const { reasons } = evaluateClaudeProfileEligibility(read);
  assert.ok(reasons.includes('kind-role'), `reasons: ${reasons.join(',')}`);
  read.task.role = 'knu_explorer';
  assert.deepEqual(evaluateClaudeProfileEligibility(read).reasons, []);
});

test('Opus admits explicit bounded independent review without fabricated critical risk', () => {
  const review = inputFor('complex-critical');
  review.envelope = buildTaskEnvelope({ request: '현재 코드를 검토해줘.' });
  review.task.impactRisk = 'low';
  review.task.complexity = 'bounded';
  review.task.uncertainty = 'resolved';

  assert.deepEqual(evaluateClaudeProfileEligibility(review), { eligible: true, reasons: [] });
  assert.equal(createClaudeSubagentBinding(review).requestedModelAlias, 'opus');
  const mediumReview = structuredClone(review);
  mediumReview.task.impactRisk = 'medium';
  assert.deepEqual(evaluateClaudeProfileEligibility(mediumReview), { eligible: true, reasons: [] });

  for (const mutate of [
    (x) => {
      x.task.kind = 'read';
      x.task.role = 'knu_explorer';
      x.task.allowedTools = [...roles.knu_explorer];
    },
    (x) => {
      x.task.independent = false;
    },
    (x) => {
      x.task.writeScope = ['scripts/agents/claude'];
      x.task.writeOwner = 'reviewer-h4l';
    },
    (x) => {
      x.task.role = 'knu_explorer';
      x.task.allowedTools = [...roles.knu_explorer];
    },
  ]) {
    const invalid = structuredClone(review);
    mutate(invalid);
    const assessed = evaluateClaudeProfileEligibility(invalid);
    assert.equal(assessed.eligible, false, JSON.stringify(invalid.task));
    // Each mutation must lose the narrowed review exemption itself, not only an older rule.
    assert.ok(assessed.reasons.includes('critical-signal'), JSON.stringify(assessed.reasons));
  }
});

test('binding refuses free-form model choice, unknown profile/fields and stale or child-selected facts', () => {
  const valid = inputFor();
  const binding = createClaudeSubagentBinding(valid);
  assert.equal(binding.requestedModelAlias, 'sonnet');
  assert.equal(binding.requestedModelSource, 'profile:bounded-standard');
  assert.match(binding.bindingDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(Object.isFrozen(binding), true);
  for (const patch of [
    { profileId: 'free-form-claude-model' },
    { model: 'opus' },
    { modelRequest: { model: 'opus' } },
    { reasoning_effort: 'low' },
    { selectedBy: 'child' },
    { selectionBasisRef: '' },
    { sourceDigest: 'unknown' },
    { configDigest: 'unknown' },
    { issuedAt: '2026-09-26T12:30:00.000Z' },
    { issuedAt: '2026-09-26T11:55:00Z' },
  ]) {
    assert.throws(() => createClaudeSubagentBinding({ ...valid, ...patch }), TypeError);
  }
  const changed = structuredClone(valid);
  changed.task.facts[0].sourceRef = 'docs/development/agent-workflows/orchestration.md';
  assert.notEqual(createClaudeSubagentBinding(changed).bindingDigest, binding.bindingDigest);
  const unsafe = structuredClone(valid);
  unsafe.task.facts[0].sourceRef = '../../private/credential';
  assert.throws(() => createClaudeSubagentBinding(unsafe), TypeError);
});

test('task admission binds current task/source/config/scope/permission/QA and refuses unknown host support', () => {
  const { binding, admission, runtime, result } = candidate();
  assert.equal(result.decision, 'candidate');
  assert.equal(result.descriptor.dispatchAllowed, false);
  assert.equal(result.descriptor.applied, false);
  assert.equal(result.descriptor.runtimeQualification, 'not-run');
  assert.deepEqual(result.descriptor.requestedModel, {
    alias: 'sonnet',
    source: 'profile:bounded-standard',
  });
  assert.equal(result.descriptor.expectedResolvedModel, 'claude-sonnet-synthetic');
  assert.equal(result.descriptor.transport, 'native-subagent');
  assert.equal(result.descriptor.host, 'claude-code');
  const base = {
    binding,
    admission,
    runtime,
    current: {
      requestId: binding.requestId,
      taskId: binding.taskId,
      sourceDigest: binding.sourceDigest,
      configDigest: binding.configDigest,
      scopeDigest: binding.scopeDigest,
      envelopeDigest: binding.envelopeDigest,
      writerInventory: { status: 'current-turn', evidenceRef: 'fixture:writer-state', active: [] },
      now,
    },
  };
  for (const mutate of [
    (x) => {
      x.admission = null;
    },
    (x) => {
      x.admission.bindingDigest = 'sha256:dead';
    },
    (x) => {
      x.admission.permission = 'denied';
    },
    (x) => {
      x.admission.approvedBy = 'child';
    },
    (x) => {
      x.admission.qaOwner = x.binding.writeOwner;
    },
    (x) => {
      x.current.requestId = 'other-request';
    },
    (x) => {
      x.current.sourceDigest = `sha256:${'a'.repeat(64)}`;
    },
    (x) => {
      x.current.configDigest = `sha256:${'a'.repeat(64)}`;
    },
    (x) => {
      x.current.scopeDigest = `sha256:${'a'.repeat(64)}`;
    },
    (x) => {
      x.current.envelopeDigest = `sha256:${'a'.repeat(64)}`;
    },
    (x) => {
      x.current.writerInventory.active = [
        { owner: 'other-writer', writeScope: ['scripts/agents'] },
      ];
    },
    (x) => {
      x.current.writerInventory.status = 'unknown';
    },
    (x) => {
      x.current.now = '2026-09-26T12:30:00.000Z';
    },
    (x) => {
      x.current.now = '2026-09-26T12:00:00Z';
    },
    (x) => {
      x.runtime.support = 'unknown';
    },
    (x) => {
      x.runtime.permission = 'denied';
    },
    (x) => {
      x.runtime.quota = 'denied';
    },
    (x) => {
      x.runtime.role = 'knu_reviewer';
    },
    (x) => {
      x.runtime.requestedAlias = 'opus';
    },
    (x) => {
      x.runtime.roleTools = ['Read'];
    },
    (x) => {
      x.runtime.expectedResolvedModel = 'unknown';
    },
    (x) => {
      x.runtime.expectedResolvedModel = 'sonnet';
    },
    (x) => {
      x.runtime.expectedResolvedModel = 'claude-opus-synthetic';
    },
  ]) {
    const input = structuredClone(base);
    mutate(input);
    const refusal = assessClaudeSubagentAdmission(input);
    assert.equal(refusal.decision, 'refuse', JSON.stringify(input));
    assert.equal(refusal.descriptor, null);
  }
  const unsupported = structuredClone(base);
  unsupported.runtime.support = 'unknown';
  assert.equal(assessClaudeSubagentAdmission(unsupported).reason, 'runtime-unknown');
  const denied = structuredClone(base);
  denied.runtime.permission = 'denied';
  assert.equal(assessClaudeSubagentAdmission(denied).reason, 'permission-denied');
  const conflict = structuredClone(base);
  conflict.current.writerInventory.active = [
    { owner: 'other-writer', writeScope: ['scripts/agents/claude'] },
  ];
  assert.equal(assessClaudeSubagentAdmission(conflict).reason, 'writer-conflict');
});

test('a caller-rehashed binding cannot bypass task/profile eligibility', () => {
  const { binding, admission, runtime } = candidate();
  const forged = structuredClone(binding);
  forged.impactRisk = 'high';
  const { bindingDigest: _old, ...data } = forged;
  forged.bindingDigest = digestObject(data);
  const sameGrant = { ...admission, bindingDigest: forged.bindingDigest };
  const result = assessClaudeSubagentAdmission({
    binding: forged,
    admission: sameGrant,
    runtime,
    current: {
      requestId: binding.requestId,
      taskId: binding.taskId,
      sourceDigest: binding.sourceDigest,
      configDigest: binding.configDigest,
      scopeDigest: binding.scopeDigest,
      envelopeDigest: binding.envelopeDigest,
      writerInventory: { status: 'current-turn', evidenceRef: 'fixture:writer-state', active: [] },
      now,
    },
  });
  assert.equal(result.decision, 'refuse');
});

test('observation separates requested/resolved/observed and cannot grant live PASS', () => {
  const { binding, result } = candidate();
  const descriptor = result.descriptor;
  const receipt = {
    bindingDigest: descriptor.bindingDigest,
    status: 'complete',
    role: descriptor.role,
    requestedAlias: descriptor.requestedModel.alias,
    resolvedModel: descriptor.expectedResolvedModel,
    observedModel: descriptor.expectedResolvedModel,
    evidenceRef: 'fixture:post-tool-use',
    oracle: 'pass',
  };
  const compatible = assessClaudeModelObservation({ binding, descriptor, receipt });
  assert.equal(compatible.decision, 'compatible-static');
  assert.equal(compatible.liveQualified, false);
  for (const patch of [
    { role: 'knu_explorer' },
    { observedModel: 'unknown' },
    { observedModel: null },
    { resolvedModel: 'claude-opus-substituted' },
    { requestedAlias: 'haiku' },
    { status: 'denied' },
    { status: 'timed-out' },
    { oracle: 'not-run' },
    { evidenceRef: '' },
  ]) {
    const refusal = assessClaudeModelObservation({
      binding,
      descriptor,
      receipt: { ...receipt, ...patch },
    });
    assert.equal(refusal.decision, 'blocked', JSON.stringify(patch));
    assert.equal(refusal.liveQualified, false);
  }
  const wrongDescriptor = structuredClone(descriptor);
  wrongDescriptor.requestedModel.source = 'profile:bounded-extraction';
  assert.equal(
    assessClaudeModelObservation({ binding, descriptor: wrongDescriptor, receipt }).decision,
    'blocked',
  );
  const substitutedDescriptor = structuredClone(descriptor);
  substitutedDescriptor.expectedResolvedModel = 'claude-opus-synthetic';
  assert.equal(
    assessClaudeModelObservation({
      binding,
      descriptor: substitutedDescriptor,
      receipt: {
        ...receipt,
        resolvedModel: 'claude-opus-synthetic',
        observedModel: 'claude-opus-synthetic',
      },
    }).decision,
    'blocked',
  );
  const forged = structuredClone(descriptor);
  forged.role = 'not-a-project-role';
  forged.allowedTools = ['SecretReader'];
  assert.equal(
    assessClaudeModelObservation({ binding, descriptor: forged, receipt }).decision,
    'blocked',
  );
  assert.equal(
    assessClaudeModelObservation({
      binding,
      descriptor,
      receipt: { ...receipt, status: 'timed-out' },
    }).reason,
    'timed-out',
  );
});

test('neutral intake to Claude proposal and H3 blocked QA is deterministic but never a host run', () => {
  const { basePacket, baseResult } = JSON.parse(
    readFileSync(
      resolve(root, 'scripts/ci/agents/common/fixtures/cross-model-handoff-cases.json'),
      'utf8',
    ),
  );
  const input = inputFor('complex-critical');
  input.sourceDigest = digestObject(basePacket.snapshot);
  const { binding, result } = candidate(input);
  assert.equal(binding.requestedModelAlias, 'opus');
  assert.equal(result.decision, 'candidate');
  assert.equal(result.descriptor.dispatchAllowed, false);
  const packet = structuredClone(basePacket);
  const qa = structuredClone(baseResult);
  packet.packetId = binding.taskId;
  packet.objective = binding.requestSummary;
  qa.packetId = binding.taskId;
  packet.lifecycle.support = 'unknown';
  qa.status = 'denied';
  qa.identity.resolvedModel = 'unknown';
  qa.identity.observedModel = 'unknown';
  qa.acceptanceCoverage[0].gap = 'No native Claude invocation was authorized.';
  qa.acceptanceCoverage[0].evidenceRefs = [];
  qa.commandsActuallyRun = [];
  qa.notRun = ['Claude native subagent model call'];
  qa.knownGaps = ['Claude runtime/model/permission qualification not run'];
  qa.confidence = 'low';
  qa.verdict = 'BLOCKED';
  qa.blocker = 'Native Claude model call not run in H3M.';
  qa.cleanup.status = 'not-started';
  const validation = validateCrossModelExchange({
    packet,
    result: qa,
    currentSnapshot: packet.snapshot,
  });
  assert.equal(validation.decision, 'accept', JSON.stringify(validation));
  assert.equal(validation.verificationClass, 'runner-live-required');
  assert.deepEqual(
    assessClaudeStaticExchange({
      binding,
      descriptor: result.descriptor,
      packet,
      result: qa,
      currentSnapshot: packet.snapshot,
    }),
    { decision: 'accept-static-blocked', liveQualified: false },
  );
  const unrelated = structuredClone(packet);
  unrelated.snapshot.headSHA = 'f'.repeat(64);
  assert.equal(
    assessClaudeStaticExchange({
      binding,
      descriptor: result.descriptor,
      packet: unrelated,
      result: qa,
      currentSnapshot: unrelated.snapshot,
    }).decision,
    'refuse',
  );
  const unrelatedObjective = structuredClone(packet);
  unrelatedObjective.objective = 'Review another unrelated change.';
  assert.equal(
    assessClaudeStaticExchange({
      binding,
      descriptor: result.descriptor,
      packet: unrelatedObjective,
      result: qa,
      currentSnapshot: unrelatedObjective.snapshot,
    }).decision,
    'refuse',
  );
  qa.verdict = 'PASS';
  assert.equal(
    validateCrossModelExchange({ packet, result: qa, currentSnapshot: packet.snapshot }).decision,
    'reject',
  );
});

test('qualification matrix leaves every native candidate and failure path not-run', () => {
  const matrix = JSON.parse(
    readFileSync(
      resolve(
        root,
        'scripts/ci/agents/claude/fixtures/claude-subagent-model-qualification-matrix.json',
      ),
      'utf8',
    ),
  );
  assert.deepEqual(
    new Set(matrix.rows.map((row) => row.profileId)),
    new Set(['bounded-extraction', 'bounded-standard', 'complex-critical']),
  );
  for (const row of matrix.rows) {
    assert.equal(row.actualInvocation, 'not-run');
    assert.ok(['haiku', 'sonnet', 'opus'].includes(row.requestedModelAlias));
    assert.match(row.expectedResolvedIdentity, /exact.*host/u);
    assert.ok(row.positiveOracle && row.adversarialOracle && row.cleanupOwner);
    assert.ok(row.denialPath && row.substitutionPath && row.timeoutPath);
    assert.ok(row.observationMethod && row.goNoGoCriterion);
    assert.deepEqual(row.tools, roles[row.role]);
    assert.ok(row.caseId && row.cleanupOwner.includes(row.caseId));
    assert.ok(row.cleanupTarget.includes(row.caseId) && row.cleanupVerifier.includes(row.caseId));
  }
});

// A registry-bound recovery travels in the task and the binding, so every recomputation agrees.
function recoveryInput(recovery) {
  const input = inputFor('bounded-standard', 'build');
  input.profileId = 'complex-critical';
  if (recovery !== undefined) input.task.recovery = recovery;
  return input;
}
const STEP_ONE = {
  of: '00000000-0000-4000-8000-000000000001',
  cause: 'result-error',
  step: 1,
  fromProfileId: 'bounded-standard',
  fromRole: 'knu_executor',
};

test('an unbound binding carries recovery null; a ladder step lifts only the critical signal', () => {
  assert.equal(candidate().binding.recovery, null);
  assert.deepEqual(evaluateClaudeProfileEligibility(recoveryInput()).reasons, ['critical-signal']);
  assert.equal(evaluateClaudeProfileEligibility(recoveryInput(STEP_ONE)).eligible, true);
  for (const recovery of [
    { ...STEP_ONE, step: 2 },
    { ...STEP_ONE, fromRole: 'knu_explorer' },
    { ...STEP_ONE, fromProfileId: 'complex-critical' },
  ])
    assert.ok(
      evaluateClaudeProfileEligibility(recoveryInput(recovery)).reasons.includes('critical-signal'),
      JSON.stringify(recovery),
    );
  for (const recovery of [{ ...STEP_ONE, cause: 'quota' }, { ...STEP_ONE, extra: true }, null])
    assert.deepEqual(
      evaluateClaudeProfileEligibility(recoveryInput(recovery)).reasons,
      ['invalid-input'],
      JSON.stringify(recovery),
    );
});

// Implementation is the Parent's own work (D-OSS-35): the ladder keeps the same-role step 1 and loses the
// executor step 2, and the policy names the retirement for a build task.
test('executor retirement: recovery keeps the same-role step 1 and has no executor step 2', () => {
  const step = policy.claudeRecoveryStep;
  assert.equal(
    step(
      { profileId: 'complex-critical', role: 'knu_executor', kind: 'build' },
      { profileId: 'complex-critical', role: 'knu_executor_xhigh', kind: 'build' },
    ),
    null,
  );
  for (const role of ['knu_explorer', 'knu_researcher'])
    assert.equal(
      step(
        { profileId: 'bounded-standard', role, kind: 'read' },
        { profileId: 'complex-critical', role, kind: 'read' },
      ),
      1,
      role,
    );
  const retry = inputFor('bounded-standard', 'read');
  retry.profileId = 'complex-critical';
  retry.task.recovery = {
    of: '00000000-0000-4000-8000-000000000001',
    cause: 'result-error',
    step: 1,
    fromProfileId: 'bounded-standard',
    fromRole: 'knu_explorer',
  };
  assert.equal(evaluateClaudeProfileEligibility(retry).eligible, true);
  retry.task.recovery = { ...retry.task.recovery, step: 2, fromProfileId: 'complex-critical' };
  assert.deepEqual(evaluateClaudeProfileEligibility(retry).reasons, ['invalid-input']);
  assert.deepEqual(
    evaluateClaudeProfileEligibility(inputFor('bounded-standard', 'build')).reasons,
    ['implementation-retired'],
  );
});

test('a step-1 recovery binding passes admission and observation; static exchange stays reviewer-only', () => {
  const { binding, result } = candidate(recoveryInput(STEP_ONE));
  assert.deepEqual(binding.recovery, STEP_ONE);
  assert.equal(result.decision, 'candidate', JSON.stringify(result));
  const descriptor = result.descriptor;
  const observed = assessClaudeModelObservation({
    binding,
    descriptor,
    receipt: {
      bindingDigest: descriptor.bindingDigest,
      status: 'complete',
      role: descriptor.role,
      requestedAlias: descriptor.requestedModel.alias,
      resolvedModel: descriptor.expectedResolvedModel,
      observedModel: descriptor.expectedResolvedModel,
      evidenceRef: 'fixture:post-tool-use',
      oracle: 'pass',
    },
  });
  assert.equal(observed.decision, 'compatible-static', JSON.stringify(observed));
  // The binding validates, so the refusal is the reviewer-only gate, not malformed input.
  assert.equal(
    assessClaudeStaticExchange({
      binding,
      descriptor,
      packet: {},
      result: {},
      currentSnapshot: {},
    }).reason,
    'role-mismatch',
  );
  // Without the bound recovery the same facts lack a critical signal, so the binding is invalid.
  const { bindingDigest, ...data } = structuredClone(binding);
  void bindingDigest;
  data.recovery = null;
  const stripped = { ...data, bindingDigest: digestObject(data) };
  assert.equal(
    assessClaudeStaticExchange({
      binding: stripped,
      descriptor,
      packet: {},
      result: {},
      currentSnapshot: {},
    }).reason,
    'invalid-input',
  );
});
