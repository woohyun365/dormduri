// Lead-side assembly for ordinary native tasks. prepare consumes the Lead's role/profile/scope/facts
// choices and the existing registry; it never infers a profile or authorizes dispatch. settle only
// assembles complete's input from the observation and the Lead's own judgment; complete still decides.
// The reviewer spec from review is a draft with the only reviewer role/profile (knu_reviewer,
// complex-critical) and review facts citing the Lead's --basis; the Lead reviews it before prepare.
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildTaskEnvelope } from '../common/intake-policy.mjs';
import { validateCrossModelPacket } from '../common/index.mjs';
import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { prepareClaudeWorkflow } from './workflow-entry.mjs';
import {
  registerClaudeNativeTask,
  completeClaudeNativeTask,
  nativeRequestIssues,
  observeClaudeNativeTask,
  currentClaudeNativeSnapshot,
  claudeNativeSnapshotDigest,
  writeClaudeNativeSubjectResponse,
  isClaudeNativeEvidencePath,
  REVIEW_RESULT_TEMPLATE_PREFIX,
} from './native-session.mjs';

const DEFAULT_LIFETIME_MINUTES = 15;
// registerClaudeNativeTask accepts a caller prompt of at most this many characters.
const PROMPT_LIMIT = 12000;
// A child that hands back a summary loses the rest of its result, so every non-reviewer child is told
// what the Parent actually receives. The stored response is capped at 1 MB, far above a normal report.
const DELIVERY_RULE =
  'Your delivered report (the SubagentHandback message when that tool is available, otherwise your final reply) is the only text the Parent receives. Put the complete result in it without summarizing; it may be long (the record limit is 1 MB).';
const KNU_ROLES = [
  'knu_explorer',
  'knu_researcher',
  'knu_executor',
  'knu_executor_xhigh',
  'knu_reviewer',
];
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
const SPEC_OPTIONAL = ['lifetimeMinutes', 'independentReview', 'recovery'];
const TASK_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
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
  // Checked here because the delivery rule below would turn an empty prompt into a non-empty one.
  if (typeof spec.prompt !== 'string' || !spec.prompt.trim()) issues.push('prompt-required');
  for (const key of ['readScope', 'writeScope'])
    if (!Array.isArray(spec[key])) issues.push(`${key}-array-required`);
  // The registry judges the cause and the binding; the spec only names the first task and a cause.
  if (
    spec.recovery !== undefined &&
    !(
      spec.recovery &&
      typeof spec.recovery === 'object' &&
      !Array.isArray(spec.recovery) &&
      Object.keys(spec.recovery).sort().join() === 'cause,of' &&
      TASK_ID.test(spec.recovery.of) &&
      typeof spec.recovery.cause === 'string'
    )
  )
    issues.push('recovery-format: {of: <first taskId>, cause}');
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

  const childPrompt =
    spec.role === 'knu_reviewer' ? spec.prompt : `${spec.prompt}\n\n${DELIVERY_RULE}`;
  if (childPrompt.length > PROMPT_LIMIT)
    fail('invalid prepare spec', [
      `prompt-exceeds-${PROMPT_LIMIT}-chars-with-delivery-rule (${childPrompt.length})`,
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
    prompt: childPrompt,
    expectedResolvedModel: spec.expectedResolvedModel,
    ...(spec.independentReview === undefined ? {} : { independentReview: spec.independentReview }),
    ...(spec.recovery === undefined ? {} : { recovery: spec.recovery }),
  };
  const registered = registerClaudeNativeTask(structuredClone(registerInput));
  return {
    taskId: registered.taskId,
    invocation: registered.invocation,
    agentInput: registered.agentInput,
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

const nativeEvidenceIssues = (root, paths) =>
  paths.some((path) => isClaudeNativeEvidencePath(root, path))
    ? ['native task evidence is not review input']
    : [];
// Review round inputs (qa.md review rounds). Round 1 reports broadly; a later round reads the
// previous round's result and reports only blocking findings, so it cannot start without it.
// Criteria ids name tracked review-criteria documents; they join the packet owners and read paths.
const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
const CRITERIA_ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const LOW_FINDING_LIMIT = 5;
function reviewRoundInputs({ reviewRound, previousResult, criteria }, root) {
  const issues = [];
  const round = Number.isInteger(reviewRound) && reviewRound >= 1 ? reviewRound : null;
  if (round === null) issues.push('review-round-required: a positive integer');
  let previous = null;
  if (round > 1 && previousResult === undefined)
    issues.push('previous-result-required-after-round-1');
  if (round === 1 && previousResult !== undefined)
    issues.push('previous-result-only-after-round-1');
  if (round > 1 && previousResult !== undefined) {
    const path =
      typeof previousResult === 'string' ? relative(root, resolve(root, previousResult)) : '';
    let value;
    if (
      !path ||
      path.startsWith('..') ||
      !existsSync(join(root, path)) ||
      !lstatSync(join(root, path)).isFile()
    )
      issues.push(`previous-result-unreadable: ${previousResult}`);
    else if (nativeEvidenceIssues(root, [path]).length)
      issues.push('previous-result-invalid: native task evidence is not review input');
    else {
      const bytes = readFileSync(join(root, path));
      try {
        value = JSON.parse(bytes);
      } catch {
        value = null;
      }
      if (
        !value ||
        typeof value !== 'object' ||
        !['PASS', 'FAIL', 'BLOCKED'].includes(value.verdict) ||
        !Array.isArray(value.findings)
      )
        issues.push('previous-result-invalid: a review result JSON with verdict and findings');
      else previous = { path, digest: packetDigest(bytes) };
    }
  }
  const ids = criteria ?? [];
  const criteriaIssue = !Array.isArray(ids)
    ? 'criteria-invalid: a list of review-criteria ids'
    : criteria !== undefined && !ids.length
      ? 'criteria-invalid: omit criteria instead of an empty list'
      : new Set(ids).size !== ids.length
        ? 'criteria-invalid: duplicate id'
        : ids
            .filter(
              (id) =>
                typeof id !== 'string' ||
                !CRITERIA_ID.test(id) ||
                id === 'readme' ||
                !existsSync(join(root, CRITERIA_DIR, `${id}.md`)) ||
                !lstatSync(join(root, CRITERIA_DIR, `${id}.md`)).isFile(),
            )
            .map((id) => `criteria-invalid: no ${CRITERIA_DIR}/${id}.md`)[0];
  if (criteriaIssue) issues.push(criteriaIssue);
  fail('invalid review request', issues);
  return {
    round,
    previous,
    criteriaPaths: ids.map((id) => `${CRITERIA_DIR}/${id}.md`),
  };
}

function validateRunnerEvidence(evidence, snapshotDigest, reviewerId, root) {
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
        !Number.isInteger(record.expectedExit) ||
        record.expectedExit < 1 ||
        record.expectedExit > 255)
    )
      issues.push(
        `records[${index}]: RED record needs purpose "red" and an integer expectedExit from 1 to 255`,
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
    else issues.push(...nativeEvidenceIssues(root, record.outputPaths));
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
    ...(textList(paths) && paths.length ? nativeEvidenceIssues(root, paths) : ['paths required']),
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
        ...subject.criteriaPaths,
      ],
    },
    evidence: {
      environment: [...new Set(evidence.records.map((record) => record.environment))].join('; '),
      prerequisites: ['Source snapshot equals the reviewed subject snapshot'],
      commands,
      tests: evidence.records.map((record) =>
        red(record)
          ? `${record.command} (RED: expected exit ${record.expectedExit}, actual exit ${record.exit})`
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
// A Parent-authored review hands its packet over as a file under this helper-owned directory, so
// the packet no longer counts against the prompt limit. The file is ignored and is not native task
// evidence, so it never enters the review snapshot. A native subject keeps its registry-held packet.
const REVIEW_PACKET_ID = /^[a-z0-9]{8}-[a-f0-9]{8}$/u;
const REVIEW_PACKET_LINE = 'KNU_REVIEW_PACKET_FILE:';
const packetDigest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function reviewPacketPath(root, reviewId) {
  if (typeof reviewId !== 'string' || !REVIEW_PACKET_ID.test(reviewId))
    throw new TypeError(`invalid review packet id: ${reviewId}`);
  const dir = resolveArtifactPath(root, ['claude-review-packets'], {});
  const path = relative(root, join(dir, `${reviewId}.json`));
  if (
    !path.startsWith('.artifacts/') ||
    path.includes('..') ||
    isClaudeNativeEvidencePath(root, path)
  )
    throw new TypeError(
      `review packet path must stay under .artifacts/ outside native evidence: ${path}`,
    );
  return { dir, path };
}
// Writes the packet bytes once. The same bytes again pass; different bytes, a symlinked ancestor or a
// target that is not a regular file are refused, so a reviewer always reads what the digest names.
export function writeClaudeReviewPacket(root, reviewId, bytes) {
  root = realpathSync(root);
  const { dir, path } = reviewPacketPath(root, reviewId);
  let current = root;
  for (const part of relative(root, dir).split('/')) {
    current = join(current, part);
    if (!existsSync(current)) mkdirSync(current, { mode: 0o700 });
    if (realpathSync(current) !== current || !lstatSync(current).isDirectory())
      throw new TypeError('artifact ancestor symlink');
  }
  const full = join(root, path);
  try {
    writeFileSync(full, bytes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!lstatSync(full).isFile() || !readFileSync(full).equals(Buffer.from(bytes)))
      throw new TypeError(`review packet ${path} differs from this review`);
  }
  if (dirname(realpathSync(full)) !== dir) throw new TypeError('artifact ancestor symlink');
  return { path, digest: packetDigest(bytes) };
}

function reviewerPrompt(logHeader, subject, packet, template, packetFile) {
  return [
    logHeader,
    'Independent read-only review of one frozen subject (same host, fresh context).',
    '- Read only packet.boundaries.allowedReadPaths at this snapshot. Do not edit, run commands or delegate.',
    '- Judge the source against each acceptanceCoverage criterion; no builder reasoning is provided or needed.',
    '- commandsActuallyRun holds the runner records. Keep them exactly; never add or claim a command yourself.',
    '- notRun lists only required checks nobody ran; knownGaps lists unresolved gaps blocking acceptance.',
    '  Either one, a coverage gap or a critical/high/medium finding forbids PASS.',
    '- Replace each coverage placeholder with sourceRefs and evidenceRefs (gap null), or keep a concrete gap.',
    '- Each finding needs severity (critical, high, medium or low), location, impact, reproduction and evidence.',
    subject.round === 1
      ? `- Review round 1: report broadly. Include lower-confidence blocking candidates with their evidence; list at most ${LOW_FINDING_LIMIT} low findings, most important first.`
      : `- Review round ${subject.round}: read the full scope again but report only blocking findings (critical, high or medium): new ones and those in the previous result that remain unresolved. Report no low findings. Previous result: ${subject.previous.path} ${subject.previous.digest}`,
    '- An empty findings list is a valid result; do not add findings to fill it.',
    ...(subject.criteriaPaths.length
      ? [
          `- Criteria documents: ${subject.criteriaPaths.join(', ')}. Judge each item whose condition applies; an unmet item is a finding that names the item id and keeps the item's default severity unless the finding gives a reason.`,
        ]
      : []),
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
    ...(packetFile
      ? [
          `- Read the packet file first with the Read tool: ${packetFile.path}. It holds the objective, sources and read boundaries. If it cannot be read or is not JSON, end with a blocker.`,
        ]
      : []),
    '- Final message: exactly one JSON object from the result template, status "complete", verdict PASS or FAIL.',
    `${REVIEW_RESULT_TEMPLATE_PREFIX}${JSON.stringify(template)}`,
    ...(packetFile ? [`${REVIEW_PACKET_LINE}${packetFile.path} ${packetFile.digest}`] : []),
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
    reviewRound,
    previousResult,
    criteria,
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
  validateRunnerEvidence(runnerEvidence, snapshotDigest, reviewerId, root);
  Object.assign(subject, reviewRoundInputs({ reviewRound, previousResult, criteria }, root));
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
  // The packet names its own file as a read path, so the path is fixed before the packet is built.
  const packetPath =
    subject.settlement === 'parent-adjudication' ? reviewPacketPath(root, reviewId).path : null;
  subject.readPaths = [
    ...new Set([
      ...subject.readPaths,
      ...subject.criteriaPaths,
      ...(subject.previous ? [subject.previous.path] : []),
      ...(packetPath ? [packetPath] : []),
    ]),
  ];
  const packet = reviewPacket(subject, runnerEvidence, reviewId);
  // The registry re-validates a native subject's packet; a Parent subject's packet is only checked here.
  const packetCheck = validateCrossModelPacket(packet, { currentSnapshot: subject.snapshot });
  fail('invalid review packet', packetCheck.errors);
  const template = resultTemplate(packet, runnerEvidence);
  const packetBytes = packetPath ? Buffer.from(`${JSON.stringify(packet)}\n`) : null;
  const packetFile = packetPath
    ? { path: packetPath, digest: packetDigest(packetBytes) }
    : undefined;
  const prompt = reviewerPrompt(logHeader, subject, packet, template, packetFile);
  fail('invalid review request', [
    ...(prompt.length <= PROMPT_LIMIT
      ? []
      : [
          `reviewer-prompt-exceeds-${PROMPT_LIMIT}-chars (${prompt.length}): ${
            packetFile
              ? 'the packet is already a file; shorten acceptance criteria or runner records'
              : 'shorten acceptance criteria, read paths or runner records'
          }`,
        ]),
  ]);
  // Only a review that will be returned leaves a packet file behind.
  if (packetFile) writeClaudeReviewPacket(root, reviewId, packetBytes);
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
    // the Parent adjudicates from its settle observation instead of a PASS settlement.
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
  return {
    ...status,
    packet,
    ...(packetFile ? { packetFile } : {}),
    resultTemplate: template,
    reviewerPrompt: prompt,
    reviewerSpec,
  };
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
// It also writes a judgment template once, holding what the records already fix; the Lead fills in
// only its own judgment, and a template left unfilled is refused before complete.
// The settled child transcript: a background completion's proof, else the recorded location.
function childTranscriptPath(state) {
  if (state.observation.completionSource !== 'SubagentStop+task-notification+transcript')
    return state.observation.childTranscriptPath ?? null;
  try {
    return JSON.parse(readFileSync(join(state.evidenceDirectory, 'transcript-proof.json'))).path;
  } catch {
    return null;
  }
}
// The same file reached through another absolute spelling (a symlinked root) still counts.
function samePath(candidate, file) {
  if (typeof candidate !== 'string') return false;
  if (candidate === file) return true;
  try {
    return realpathSync(candidate) === realpathSync(file);
  } catch {
    return false;
  }
}
// A Read of the packet file counts only when its tool_result is not an error.
function readPacketInTranscript(path, file) {
  let rows;
  try {
    rows = readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      });
  } catch {
    return false;
  }
  const content = (row) => (Array.isArray(row?.message?.content) ? row.message.content : []);
  const reads = rows.flatMap((row) =>
    row?.type === 'assistant'
      ? content(row).filter(
          (c) => c?.type === 'tool_use' && c.name === 'Read' && samePath(c.input?.file_path, file),
        )
      : [],
  );
  const results = rows.flatMap((row) =>
    row?.type === 'user' ? content(row).filter((c) => c?.type === 'tool_result') : [],
  );
  return reads.some((use) =>
    results.some((result) => result.tool_use_id === use.id && result.is_error !== true),
  );
}
// For a review whose prompt names a packet file: did the reviewer read it, and is it unchanged?
function reviewPacketStatus(state, root) {
  const { invocation } = JSON.parse(readFileSync(join(state.evidenceDirectory, 'task.json')));
  const line = invocation.prompt.split('\n').find((l) => l.startsWith(REVIEW_PACKET_LINE));
  // A Parent-judged reviewer always gets a packet file; a prompt without the line was edited.
  if (line === undefined)
    return state.record.input.nativeRequest.task.role === 'knu_reviewer' &&
      !state.record.independentReview
      ? { path: null, expectedDigest: null, currentDigest: null, read: false, missing: true }
      : null;
  const [path, expectedDigest] = line.slice(REVIEW_PACKET_LINE.length).split(' ');
  let currentDigest = null;
  try {
    currentDigest = packetDigest(readFileSync(join(root, path)));
  } catch {
    currentDigest = null;
  }
  const transcript = childTranscriptPath(state);
  return {
    path,
    expectedDigest,
    currentDigest,
    read: transcript !== null && readPacketInTranscript(transcript, resolve(root, path)),
  };
}
function settlementStatus(taskId, root) {
  const state = observeClaudeNativeTask(taskId, { root });
  if (state.errors.includes('no-completion-observation'))
    throw new TypeError(
      `cannot settle yet (${state.errors.join(',')}): wait for the completed task-notification, then settle`,
    );
  const reviewPacket = reviewPacketStatus(state, root);
  if (reviewPacket?.missing) state.errors.push('review-packet-missing');
  else if (reviewPacket && !reviewPacket.read) state.errors.push('review-packet-unread');
  if (reviewPacket && reviewPacket.currentDigest !== reviewPacket.expectedDigest)
    state.errors.push('review-packet-changed');
  const content = state.observation.response?.content;
  const { record } = state;
  let judgmentTemplatePath = null;
  // A reviewer without a native subject is judged by the Parent from this settle observation.
  if (record.input.nativeRequest.task.role !== 'knu_reviewer' || record.independentReview) {
    judgmentTemplatePath = join(state.evidenceDirectory, 'judgment-template.json');
    const template = {
      responseDigest: state.observation.responseDigest,
      acceptance: record.input.directAssignment.acceptance.map((criterion) => ({
        criterion,
        passed: null,
        evidenceRef: null,
      })),
      checks: [],
      // complete asks for a linked reviewer under exactly this condition.
      ...(!record.independentReview && record.input.reviewDisposition.required === true
        ? { reviewerTaskId: null }
        : {}),
    };
    try {
      writeFileSync(judgmentTemplatePath, `${JSON.stringify(template, null, 2)}\n`, {
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error; // Keep the Lead's edits.
    }
  }
  return {
    taskId,
    responseDigest: state.observation.responseDigest,
    response: content?.length === 1 && content[0]?.type === 'text' ? content[0].text : content,
    resolvedModel: state.observation.resolvedModel,
    changedPaths: state.changedPaths,
    observedEfforts: state.observedEfforts,
    acceptance: state.record.input.directAssignment.acceptance,
    observationErrors: state.errors,
    ...(reviewPacket ? { reviewPacket } : {}),
    judgmentTemplatePath,
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
  else
    judgment.acceptance.forEach((item, index) => {
      const named = item && typeof item === 'object' && typeof item.criterion === 'string';
      if (
        !named ||
        typeof item.passed !== 'boolean' ||
        typeof item.evidenceRef !== 'string' ||
        !item.evidenceRef.trim()
      )
        issues.push(`acceptance-unfilled:${named ? item.criterion : index}`);
    });
  if (judgment.reviewerTaskId === null) issues.push('reviewer-task-id-unfilled');
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
      'parent-adjudication: this reviewer has no native subject; the Parent judges its settle --task observation (observationErrors empty) and findings',
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
