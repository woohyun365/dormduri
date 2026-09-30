// Lead-side assembly for ordinary native tasks. prepare consumes the Lead's role/profile/scope/facts
// choices and the existing registry; it never infers a profile or authorizes dispatch. settle only
// assembles complete's input from the observation and the Lead's own judgment; complete still decides.
// The reviewer spec from review is a draft with the only reviewer role/profile (knu_reviewer,
// complex-critical) and review facts citing the Lead's --basis; the Lead reviews it before prepare.
import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildTaskEnvelope } from '../common/intake-policy.mjs';
import { validateCrossModelPacket } from '../common/index.mjs';
import { prepareClaudeWorkflow } from './workflow-entry.mjs';
import {
  registerClaudeNativeTask,
  completeClaudeNativeTask,
  nativeRequestIssues,
  observeClaudeNativeTask,
  currentClaudeNativeSnapshot,
  claudeNativeSnapshotDigest,
  writeClaudeNativeSubjectResponse,
  REVIEW_RESULT_TEMPLATE_PREFIX,
} from './native-session.mjs';

const DEFAULT_LIFETIME_MINUTES = 15;
// registerClaudeNativeTask accepts a caller prompt of at most this many characters.
const PROMPT_LIMIT = 12000;
const KNU_ROLES = ['knu_explorer', 'knu_researcher', 'knu_executor', 'knu_reviewer'];
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u;
const SPEC_REQUIRED = [
  'sessionId',
  'request',
  'role',
  'profileId',
  'selectionBasisRef',
  'expectedResolvedModel',
  'kind',
  'impactRisk',
  'complexity',
  'uncertainty',
  'childValue',
  'owner',
  'readScope',
  'writeScope',
  'acceptance',
  'reviewDisposition',
  'facts',
  'prompt',
];
const SPEC_OPTIONAL = ['lifetimeMinutes', 'independentReview'];
const RUNNER_RECORD_FIELDS = [
  'command',
  'exit',
  'environment',
  'observedResult',
  'outputPaths',
  'sourceDigest',
];
// A RED record shows a check failing before the fix. It declares the exit it expects; only that exit
// keeps it out of knownFailures, and any other exit, including 0, is a known failure.
const RED_RECORD_FIELDS = ['purpose', 'expectedExit'];
const red = (record) => record.purpose === 'red';
const knownFailure = (record) =>
  red(record) ? record.exit !== record.expectedExit : record.exit !== 0;
const REVIEW_FACTS = [
  'source-bound',
  'bounded-scope',
  'acceptance',
  'oracle',
  'independent-qa',
  'fresh-context',
];
const textList = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
function fail(label, issues) {
  if (issues.length) throw new TypeError(`${label}: ${issues.join('; ')}`);
}

function roleTools(root, role) {
  const text = readFileSync(join(root, '.claude/agents', `${role}.md`), 'utf8');
  const header = /^---\n([\s\S]*?)\n---/u.exec(text)?.[1] ?? '';
  return (/^tools: (.+)$/mu.exec(header)?.[1] ?? '').split(',').map((tool) => tool.trim());
}

// Minimal spec → the exact register input. The registry and model policy stay the only judges.
export function prepareClaudeNativeTask(spec, { root = process.cwd(), now = Date.now() } = {}) {
  root = realpathSync(root);
  const issues = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec))
    fail('invalid prepare spec', ['object required']);
  for (const key of Object.keys(spec))
    if (![...SPEC_REQUIRED, ...SPEC_OPTIONAL].includes(key)) issues.push(`unknown-field:${key}`);
  if (typeof spec.selectionBasisRef !== 'string' || !spec.selectionBasisRef.trim())
    issues.push('selection-basis-required');
  for (const key of SPEC_REQUIRED)
    if (key !== 'selectionBasisRef' && spec[key] === undefined) issues.push(`missing-field:${key}`);
  const lifetime = spec.lifetimeMinutes ?? DEFAULT_LIFETIME_MINUTES;
  if (!Number.isSafeInteger(lifetime) || lifetime < 1) issues.push('binding-lifetime-invalid');
  else if (lifetime > 30) issues.push('binding-lifetime-exceeds-30m');
  if (typeof spec.owner !== 'string' || !ID.test(spec.owner)) issues.push('owner-identifier');
  if (!textList(spec.acceptance) || !spec.acceptance.length) issues.push('acceptance-required');
  if (!Array.isArray(spec.facts) || !spec.facts.length) issues.push('facts-required');
  if (!KNU_ROLES.includes(spec.role)) issues.push('unknown-role');
  for (const key of ['readScope', 'writeScope'])
    if (!Array.isArray(spec[key])) issues.push(`${key}-array-required`);
  fail('invalid prepare spec', issues);
  const reviewHeader = /^KNU review snapshot (sha256:[a-f0-9]{64})\n/u.exec(spec.prompt)?.[1];
  // A review prompt names the round it was built for; a later source change makes it stale.
  if (
    reviewHeader &&
    reviewHeader !== claudeNativeSnapshotDigest(currentClaudeNativeSnapshot(root))
  )
    fail('invalid prepare spec', [
      'review-snapshot-stale: rebuild the review for the current source',
    ]);

  const short = randomUUID().slice(0, 8);
  const issuedAt = new Date(now - 1000).toISOString();
  const writing = spec.writeScope.length > 0;
  const nativeRequest = {
    profileId: spec.profileId,
    selectedBy: 'lead',
    selectionBasisRef: spec.selectionBasisRef,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + lifetime * 60000).toISOString(),
    task: {
      taskId: `${spec.role}-${short}`,
      kind: spec.kind,
      impactRisk: spec.impactRisk,
      complexity: spec.complexity,
      uncertainty: spec.uncertainty,
      role: spec.role,
      allowedTools: roleTools(root, spec.role),
      readScope: spec.readScope,
      writeScope: spec.writeScope,
      writeOwner: writing ? spec.owner : null,
      childValue: spec.childValue,
      independent: true,
      knownGaps: [],
      facts: spec.facts,
    },
  };
  fail('invalid prepare spec', nativeRequestIssues(nativeRequest));
  const registerInput = {
    workflowInput: {
      root,
      request: spec.request,
      mode: 'fresh',
      directAssignment: {
        owner: spec.owner,
        dispatchId: `${spec.owner}-${short}`,
        acceptance: spec.acceptance,
        writeOwnership: spec.writeScope,
      },
      reviewDisposition: spec.reviewDisposition,
      nativeRequest,
    },
    sessionId: spec.sessionId,
    prompt: spec.prompt,
    expectedResolvedModel: spec.expectedResolvedModel,
    ...(spec.independentReview === undefined ? {} : { independentReview: spec.independentReview }),
  };
  const registered = registerClaudeNativeTask(structuredClone(registerInput));
  return {
    taskId: registered.taskId,
    invocation: registered.invocation,
    evidenceDirectory: registered.evidenceDirectory,
    lifetimeMinutes: lifetime,
    selection: {
      profileId: spec.profileId,
      selectedBy: 'lead',
      selectionBasisRef: spec.selectionBasisRef,
    },
    registerInput,
    dispatchAuthorized: false,
  };
}

function validateRunnerEvidence(evidence, snapshotDigest, reviewerId) {
  const issues = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
    fail('invalid runner evidence', ['object required']);
  if (!isDeepStrictEqual(Object.keys(evidence).sort(), ['records', 'runner']))
    issues.push('runner evidence fields are runner and records');
  if (typeof evidence.runner !== 'string' || !ID.test(evidence.runner))
    issues.push('runner identifier required');
  if (evidence.runner === reviewerId) issues.push('the read-only reviewer cannot be the runner');
  if (!Array.isArray(evidence.records) || !evidence.records.length)
    issues.push('at least one runner record is required');
  for (const [index, record] of (Array.isArray(evidence.records)
    ? evidence.records
    : []
  ).entries()) {
    const keys = record && typeof record === 'object' ? Object.keys(record) : [];
    const redKeys = keys.filter((key) => RED_RECORD_FIELDS.includes(key));
    if (
      !record ||
      typeof record !== 'object' ||
      !isDeepStrictEqual(
        keys.filter((key) => !RED_RECORD_FIELDS.includes(key)).sort(),
        [...RUNNER_RECORD_FIELDS].sort(),
      )
    ) {
      issues.push(
        `records[${index}]: runner evidence record fields are ${RUNNER_RECORD_FIELDS.join(', ')}, plus ${RED_RECORD_FIELDS.join(' and ')} together for a RED record`,
      );
      continue;
    }
    if (
      redKeys.length &&
      (redKeys.length !== RED_RECORD_FIELDS.length ||
        record.purpose !== 'red' ||
        !Number.isSafeInteger(record.expectedExit) ||
        record.expectedExit === 0)
    )
      issues.push(
        `records[${index}]: RED record needs purpose "red" and a non-zero integer expectedExit`,
      );
    if (!Number.isSafeInteger(record.exit)) issues.push(`records[${index}].exit integer`);
    for (const field of ['command', 'environment', 'observedResult'])
      if (typeof record[field] !== 'string' || !record[field].trim())
        issues.push(`records[${index}].${field} text`);
    if (
      !textList(record.outputPaths) ||
      !record.outputPaths.every((path) => path.startsWith('.artifacts/') && !path.includes('..'))
    )
      issues.push(`records[${index}].outputPaths must stay under .artifacts/`);
    if (record.sourceDigest !== snapshotDigest)
      issues.push(
        `records[${index}].sourceDigest is not the current subject snapshot ${snapshotDigest}`,
      );
  }
  fail('invalid runner evidence', issues);
}

function subjectOf({ subjectTaskId, parentSubject }, root) {
  if ((subjectTaskId === undefined) === (parentSubject === undefined))
    throw new TypeError('review needs exactly one of subjectTaskId or parentSubject');
  if (subjectTaskId !== undefined) {
    const state = observeClaudeNativeTask(subjectTaskId, { root });
    if (state.errors.length)
      throw new TypeError(
        `subject is not settled (${state.errors.join(',')}); wait for its completed task-notification, then review`,
      );
    const { record } = state;
    return {
      settlement: 'native-subject',
      taskId: record.taskId,
      sessionId: record.sessionId,
      objective: record.requestSummary,
      owner: record.input.directAssignment.owner,
      acceptance: record.input.directAssignment.acceptance,
      readOnly: record.input.directAssignment.writeOwnership.length === 0,
      readPaths: [
        ...new Set([
          ...record.input.nativeRequest.task.readScope,
          ...record.input.directAssignment.writeOwnership,
          ...state.changedPaths,
        ]),
      ],
      impactRisk: record.input.nativeRequest.task.impactRisk,
      snapshot: state.observation.finalSnapshot,
    };
  }
  const { request, owner, acceptance, paths, ...extra } = parentSubject ?? {};
  fail('invalid parentSubject', [
    ...Object.keys(extra).map((key) => `unknown-field:${key}`),
    ...(typeof request === 'string' && request.trim() ? [] : ['request required']),
    ...(typeof owner === 'string' && ID.test(owner) ? [] : ['owner identifier required']),
    ...(textList(acceptance) && acceptance.length ? [] : ['acceptance required']),
    ...(textList(paths) && paths.length ? [] : ['paths required']),
  ]);
  return {
    settlement: 'parent-adjudication',
    taskId: null,
    sessionId: undefined,
    objective: buildTaskEnvelope({ request }).requestSummary,
    owner,
    acceptance,
    readPaths: [...new Set(paths)],
    impactRisk: 'medium',
    snapshot: currentClaudeNativeSnapshot(root),
  };
}

function reviewPacket(subject, evidence, reviewId) {
  const commands = evidence.records.map((record) => record.command);
  return {
    schemaVersion: 'cross-model-handoff/v1',
    packetId: `review-${reviewId}`,
    objective: subject.objective,
    nonScope: ['Edits or writer takeover', 'Nested delegation', 'Checks the runner did not record'],
    authority: {
      integrationOwner: 'parent',
      writeOwner: subject.owner,
      runnerOwner: evidence.runner,
      parentClarificationOwner: 'parent',
      reviewerMode: 'read-only',
    },
    snapshot: subject.snapshot,
    sources: {
      requirements: subject.acceptance,
      contracts: subject.readPaths,
      owners: [
        'docs/development/agent-workflows/qa.md',
        'docs/development/agent-workflows/adapters/claude-code.md',
      ],
    },
    evidence: {
      environment: [...new Set(evidence.records.map((record) => record.environment))].join('; '),
      prerequisites: ['Source snapshot equals the reviewed subject snapshot'],
      commands,
      tests: evidence.records.map((record) =>
        red(record)
          ? `${record.command} (RED: expected exit ${record.expectedExit})`
          : record.command,
      ),
      knownFailures: evidence.records.filter(knownFailure).map((record) => record.command),
      knownGaps: [],
      sanitizedLinks: [...new Set(evidence.records.flatMap((record) => record.outputPaths))],
    },
    boundaries: {
      allowedReadPaths: subject.readPaths,
      doNotTouch: [],
      permittedReadsAndTests: ['repository-read', 'test-result-read'],
      forbiddenMutations: ['workspace-write', 'provider-delegation', 'credential-read'],
      permittedOutputPaths: ['.artifacts'],
      allowedTools: ['repository-read', 'test-result-read'],
      disclosure: 'sanitized-only',
    },
    review: {
      freshContext: true,
      contextIsolationMethod: 'fresh-scoped-context',
      excludedInputs: ['builder-transcript', 'self-pass', 'expected-answer', 'hidden-oracle'],
      includedInputs: [
        'requirements',
        'contracts',
        'source-identity',
        'known-failures',
        'boundaries',
        'stop-conditions',
      ],
    },
    lifecycle: {
      dispatchId: `review-dispatch-${reviewId}`,
      transport: 'native',
      support: 'supported',
      stopConditions: [
        'Return one terminal JSON result',
        'Stop before any mutation or nested call',
      ],
      cancelOwner: 'parent',
      timeoutMs: 1_800_000,
      cleanupOwner: 'parent',
    },
    intent: {
      direction: 'same-host-independent-review',
      modelIntent: 'independent-read-only-reviewer',
    },
  };
}

// Commands come only from runner records; the placeholder gaps keep an unfilled template from PASS.
function resultTemplate(packet, evidence) {
  return {
    schemaVersion: 'cross-model-handoff/v1',
    packetId: packet.packetId,
    dispatchId: packet.lifecycle.dispatchId,
    resultId: `result-${packet.packetId.slice(7)}`,
    status: 'complete',
    reviewedSnapshot: packet.snapshot,
    contextIsolationMethod: 'fresh-scoped-context',
    identity: {
      requestedModelIntent: packet.intent.modelIntent,
      resolvedModel: 'unknown',
      observedModel: 'unknown',
    },
    acceptanceCoverage: packet.sources.requirements.map((criterion) => ({
      criterion,
      sourceRefs: [],
      evidenceRefs: [],
      gap: 'Reviewer replaces this with source and evidence refs, or keeps a concrete gap.',
    })),
    findings: [],
    commandsActuallyRun: evidence.records.map((record) => ({
      runner: evidence.runner,
      exit: record.exit,
      ...(red(record) ? { purpose: record.purpose, expectedExit: record.expectedExit } : {}),
      observedResult: record.observedResult,
      environment: record.environment,
      outputPaths: record.outputPaths,
    })),
    notRun: [],
    knownGaps: [],
    confidence: 'medium',
    verdict: 'FAIL',
    blocker: null,
    disposition: { owner: 'parent', nextAction: 'Parent adjudicates the review result.' },
    cleanup: {
      owner: 'parent',
      status: 'complete',
      handoff: 'Read-only review; nothing to clean up.',
    },
    handoff: { integrationOwner: 'parent', requestedWriteOwner: null },
  };
}

// Criteria and runner records appear once, inside the template, to stay within the register limit.
function reviewerPrompt(logHeader, subject, packet, template) {
  return [
    logHeader,
    'Independent read-only review of one frozen subject (same host, fresh context).',
    '- Read only packet.boundaries.allowedReadPaths at this snapshot. Do not edit, run commands or delegate.',
    '- Judge the source against each acceptanceCoverage criterion; no builder reasoning is provided or needed.',
    '- commandsActuallyRun holds the runner records. Keep them exactly; never add or claim a command yourself.',
    '- notRun lists only required checks nobody ran; knownGaps lists unresolved gaps blocking acceptance.',
    '  Either one, a coverage gap or a critical/high/medium finding forbids PASS.',
    '- Replace each coverage placeholder with sourceRefs and evidenceRefs (gap null), or keep a concrete gap.',
    '- Each finding needs severity, location, impact, reproduction and evidence.',
    ...(subject.responsePath
      ? [
          `- ${subject.responsePath} is the read-only subject's response under review; its claims and self-assessment are not evidence. Check them against the other read paths.`,
        ]
      : []),
    ...(template.commandsActuallyRun.some((command) => command.purpose === 'red')
      ? [
          '- A record with purpose "red" shows a check failing before the fix; it is a known failure unless exit equals expectedExit.',
        ]
      : []),
    '- Final message: exactly one JSON object from the result template, status "complete", verdict PASS or FAIL.',
    `${REVIEW_RESULT_TEMPLATE_PREFIX}${JSON.stringify(template)}`,
    ...(subject.settlement === 'parent-adjudication'
      ? [`KNU_REVIEW_PACKET:${JSON.stringify(packet)}`]
      : []),
  ].join('\n');
}

// Without runner evidence this only reports the round's snapshot digest, which the runner puts on
// the first line of its log and in every record. With evidence it builds the frozen review inputs.
export function buildClaudeNativeReview(
  {
    subjectTaskId,
    parentSubject,
    runnerEvidence,
    selectionBasisRef,
    reviewerModel,
    reviewerId = 'reviewer',
    sessionId,
    request,
    impactRisk,
  } = {},
  { root = process.cwd() } = {},
) {
  root = realpathSync(root);
  const subject = subjectOf({ subjectTaskId, parentSubject }, root);
  const snapshotDigest = claudeNativeSnapshotDigest(subject.snapshot);
  const logHeader = `KNU review snapshot ${snapshotDigest}`;
  const status = {
    settlement: subject.settlement,
    subjectTaskId: subject.taskId,
    snapshotDigest,
    logHeader,
    dispatchAuthorized: false,
  };
  if (runnerEvidence === undefined) return status;
  fail('invalid review request', [
    ...(typeof selectionBasisRef === 'string' && selectionBasisRef.trim()
      ? []
      : ['selection-basis-required']),
    ...(typeof reviewerModel === 'string' ? [] : ['reviewer-model-required']),
    ...(typeof reviewerId === 'string' && ID.test(reviewerId) && reviewerId !== subject.owner
      ? []
      : ['reviewer must be an identifier distinct from the subject owner']),
  ]);
  validateRunnerEvidence(runnerEvidence, snapshotDigest, reviewerId);
  if (subject.settlement === 'native-subject') {
    // The reviewer can check a read-only subject's claims against its read scope and the raw runner
    // outputs; the response itself is read from a file bound to the settled response.
    subject.responsePath = subject.readOnly
      ? writeClaudeNativeSubjectResponse(subject.taskId, { root })
      : undefined;
    subject.readPaths = [
      ...new Set([
        ...(subject.responsePath ? [subject.responsePath] : []),
        ...subject.readPaths,
        ...runnerEvidence.records.flatMap((record) => record.outputPaths),
      ]),
    ];
  }
  const reviewId = `${(subject.taskId ?? snapshotDigest.slice(7)).slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  const packet = reviewPacket(subject, runnerEvidence, reviewId);
  // The registry re-validates a native subject's packet; a Parent subject's packet is only checked here.
  const packetCheck = validateCrossModelPacket(packet, { currentSnapshot: subject.snapshot });
  fail('invalid review packet', packetCheck.errors);
  const template = resultTemplate(packet, runnerEvidence);
  const prompt = reviewerPrompt(logHeader, subject, packet, template);
  fail('invalid review request', [
    ...(prompt.length <= PROMPT_LIMIT
      ? []
      : [
          `reviewer-prompt-exceeds-${PROMPT_LIMIT}-chars (${prompt.length}): shorten acceptance criteria, read paths or runner records`,
        ]),
  ]);
  const native = subject.settlement === 'native-subject';
  const reviewerSpec = {
    sessionId: sessionId ?? subject.sessionId,
    request:
      request ??
      (native
        ? `KNU native task ${subject.taskId.slice(0, 8)} 결과를 독립 검토해줘.`
        : `Parent 작성 변경 ${snapshotDigest.slice(7, 15)} 결과를 독립 검토해줘.`),
    role: 'knu_reviewer',
    profileId: 'complex-critical',
    selectionBasisRef,
    expectedResolvedModel: reviewerModel,
    kind: 'review',
    impactRisk: impactRisk ?? subject.impactRisk,
    complexity: 'bounded',
    uncertainty: 'resolved',
    childValue: 'independent-review',
    owner: reviewerId,
    readScope: subject.readPaths,
    writeScope: [],
    acceptance: ['terminal review result delivered for the frozen packet'],
    // A reviewer without a native subject cannot be a terminal reviewer; it stays QA-required and
    // the Parent adjudicates from its completion observation instead of a PASS settlement.
    reviewDisposition: native
      ? { required: false, reason: 'terminal same-host independent native review' }
      : { required: true, reason: 'Parent-authored subject: Parent adjudicates this review' },
    facts: REVIEW_FACTS.map((key) => ({ key, sourceRef: selectionBasisRef, confidence: 'high' })),
    prompt,
    ...(native
      ? {
          independentReview: {
            subjectTaskId: subject.taskId,
            reviewerId,
            builderIds: [subject.owner],
            packet,
          },
        }
      : {}),
  };
  return { ...status, packet, resultTemplate: template, reviewerPrompt: prompt, reviewerSpec };
}

const JUDGMENT_FIELDS = [
  'responseDigest',
  'acceptance',
  'checks',
  'findings',
  'gaps',
  'reviewerTaskId',
];
// complete's input from the settled observation plus the Lead's judgment. The Lead states the digest
// of the response it judged and each acceptance result; lane ids, snapshot, observed changed paths
// and a reviewer's delivered result come from the records, so none of them is retyped by hand.
// Without a judgment it only settles the observation and shows what the Lead must judge: the
// response, its digest, the observed changes and the acceptance criteria. It decides nothing.
function settlementStatus(taskId, root) {
  const state = observeClaudeNativeTask(taskId, { root });
  if (state.errors.includes('no-completion-observation'))
    throw new TypeError(
      `cannot settle yet (${state.errors.join(',')}): wait for the completed task-notification, then settle`,
    );
  const content = state.observation.response?.content;
  return {
    taskId,
    responseDigest: state.observation.responseDigest,
    response: content?.length === 1 && content[0]?.type === 'text' ? content[0].text : content,
    resolvedModel: state.observation.resolvedModel,
    changedPaths: state.changedPaths,
    acceptance: state.record.input.directAssignment.acceptance,
    observationErrors: state.errors,
    dispatchAuthorized: false,
  };
}
export function settleClaudeNativeTask(taskId, judgment, { root = process.cwd() } = {}) {
  root = realpathSync(root);
  if (judgment === undefined) return settlementStatus(taskId, root);
  const issues = [];
  if (!judgment || typeof judgment !== 'object' || Array.isArray(judgment))
    fail('invalid settle judgment', ['object required']);
  for (const key of Object.keys(judgment))
    if (!JUDGMENT_FIELDS.includes(key)) issues.push(`unknown-field:${key}`);
  if (typeof judgment.responseDigest !== 'string' || !judgment.responseDigest)
    issues.push('response-digest-required');
  if (!Array.isArray(judgment.acceptance)) issues.push('acceptance-array-required');
  if (!textList(judgment.checks) || !judgment.checks.length) issues.push('checks-required');
  for (const key of ['findings', 'gaps'])
    if (judgment[key] !== undefined && !Array.isArray(judgment[key]))
      issues.push(`${key}-array-required`);
  fail('invalid settle judgment', issues);
  const state = observeClaudeNativeTask(taskId, { root });
  if (state.errors.includes('no-completion-observation'))
    throw new TypeError(
      `cannot settle yet (${state.errors.join(',')}): wait for the completed task-notification, then settle`,
    );
  const { record, observation } = state;
  const reviewer = record.input.nativeRequest.task.role === 'knu_reviewer';
  if (reviewer && !record.independentReview)
    throw new TypeError(
      'parent-adjudication: this reviewer has no native subject; the Parent judges its completion.json',
    );
  const lane = prepareClaudeWorkflow({
    ...record.input,
    currentSnapshot: observation.finalSnapshot,
  }).lanes[0];
  const submitted = {
    results: [
      {
        resultId: `result-${record.taskId.slice(0, 8)}`,
        dispatchId: lane.dispatchId,
        laneId: lane.id,
        owner: lane.owner,
        hostId: 'claude-code',
        adapterIdentity: record.input.adapterIdentity,
        sourceSnapshot: observation.finalSnapshot,
        status: 'complete',
        checks: judgment.checks,
        findings: judgment.findings ?? [],
        gaps: judgment.gaps ?? [],
        changedPaths: state.changedPaths,
      },
    ],
    responseDigest: judgment.responseDigest,
    acceptance: judgment.acceptance,
    ...(judgment.reviewerTaskId === undefined ? {} : { reviewerTaskId: judgment.reviewerTaskId }),
  };
  if (record.independentReview) {
    try {
      submitted.reviewResult = JSON.parse(observation.response.content[0].text);
    } catch {
      /* complete reports the missing delivered JSON result. */
    }
  }
  return { ...completeClaudeNativeTask(taskId, submitted, { root }), submitted };
}
