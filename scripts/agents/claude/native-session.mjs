// Ordinary interactive session adapter. No child process, permission allow, Home edits,
// or host authentication: files coordinate one task; Claude owns execution/permissions.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  existsSync,
  lstatSync,
  statSync,
  readlinkSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve, dirname, relative, basename, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { validateAdapterReview, validateCrossModelPacket } from '../common/index.mjs';
import { prepareClaudeWorkflow, validateClaudeWorkflowResults } from './workflow-entry.mjs';
import { claudeRecoveryStep } from './model-policy.mjs';
import {
  readClaudeStoppedTranscript,
  readClaudeTranscriptEfforts,
  isClaudeCompletedNotification,
} from './native-session-evidence.mjs';
import { runClaudePreflight } from './session-preflight.mjs';

const ownDirectory = dirname(fileURLToPath(import.meta.url));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const CHILD_ID = /^[a-zA-Z0-9_-]{1,80}$/u;
const ROLE_EFFORTS = ['medium', 'high', 'xhigh'];
const marker = /\n\nKNU_NATIVE_TASK:([a-f0-9-]{36}):(sha256:[a-f0-9]{64})$/u;
// The short Agent input carries only the marker line; PreToolUse injects the registered invocation.
const shortMarker = /^KNU_NATIVE_TASK:([a-f0-9-]{36}):(sha256:[a-f0-9]{64})$/u;
const registeredPrompt = ({ prompt, independentReview, taskId }, digest) =>
  `${prompt}${independentReview ? `\n\nKNU_INDEPENDENT_REVIEW_PACKET:${JSON.stringify(independentReview.packet)}` : ''}\n\nKNU_NATIVE_TASK:${taskId}:${digest}`;
const agentInputOf = ({ description, subagent_type, model, prompt }) => ({
  description,
  subagent_type,
  model,
  prompt: prompt.slice(prompt.lastIndexOf('KNU_NATIVE_TASK:')),
});
const hash = (value) =>
  `sha256:${createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex')}`;
const inputHash = (value) =>
  hash(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
function check(value, reason) {
  if (!value) throw new TypeError(reason);
}
function exact(value, keys, reason) {
  check(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()),
    reason,
  );
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
function jsonFile(path) {
  check(realpathSync(path) === path, 'artifact symlink');
  const raw = readFileSync(path);
  check(raw.length <= 1024 * 1024, 'oversized artifact');
  return JSON.parse(raw);
}
function taskDirectory(root, id) {
  check(uuid.test(id), 'invalid task id');
  // Fixed repo-local owner: do not let ambient artifact configuration redirect hook writes.
  return resolveArtifactPath(root, ['claude-native', id], {});
}
// A read-only subject's response is its deliverable, so review reads it from this file. A writer's
// response carries builder rationale and self-assessment, so it never becomes review input.
function subjectResponsePath(root, id) {
  return relative(root, join(taskDirectory(root, id), 'subject-response.txt'));
}
// Built from the digest-bound response, never from the mirrored top-level content field.
function subjectResponseText(observation) {
  const content = observation.response?.content;
  return content?.length === 1 && content[0]?.type === 'text'
    ? content[0].text
    : JSON.stringify(content);
}
function sameSubjectResponse(root, path, text) {
  const absolute = join(root, path);
  return (
    existsSync(absolute) &&
    realpathSync(absolute) === absolute &&
    lstatSync(absolute).isFile() &&
    readFileSync(absolute, 'utf8') === text
  );
}
// Task records, completions and transcripts hold prompts and builder responses. A review path must
// not reach them under another case (case-insensitive filesystems), through a symlink, or through a
// directory under .artifacts that links into them, however deep or through linked directories.
export function isClaudeNativeEvidencePath(root, path) {
  const base = relative(root, resolveArtifactPath(root, ['claude-native'], {})).toLowerCase();
  const inside = (candidate) => {
    const lower = candidate.toLowerCase();
    return lower === base || lower.startsWith(`${base}/`) || base.startsWith(`${lower}/`);
  };
  if (inside(path)) return true;
  const absolute = join(root, path);
  if (!existsSync(absolute)) return false;
  const realRoot = realpathSync(root);
  const target = realpathSync(absolute);
  if (inside(relative(realRoot, target))) return true;
  if (!path.toLowerCase().startsWith('.artifacts/') || !statSync(target).isDirectory())
    return false;
  // Each real directory is scanned once, so a link cycle ends.
  const seen = new Set();
  const scan = (directory) => {
    if (seen.has(directory)) return false;
    seen.add(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        if (!existsSync(child)) continue;
        const linked = realpathSync(child);
        if (inside(relative(realRoot, linked))) return true;
        if (statSync(linked).isDirectory() && scan(linked)) return true;
      } else if (entry.isDirectory() && scan(child)) return true;
    }
    return false;
  };
  return scan(target);
}
function ensureLocalDirectory(root, target) {
  let current = root;
  for (const part of target.slice(root.length + 1).split('/')) {
    current = join(current, part);
    if (!existsSync(current)) mkdirSync(current, { mode: 0o700 });
    check(
      realpathSync(current) === current && lstatSync(current).isDirectory(),
      'artifact ancestor symlink',
    );
  }
}
function inventory(root, readScope = []) {
  const names = execFileSync(
    'git',
    ['-c', 'core.fsmonitor=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, maxBuffer: 4 * 1024 * 1024, timeout: 5000 },
  )
    .toString()
    .split('\0')
    .filter(Boolean);
  for (const p of readScope) {
    const path = join(root, p);
    if (existsSync(path) && lstatSync(path).isFile()) names.push(p);
  }
  return Object.fromEntries(
    [...new Set(names)].sort().map((p) => {
      const path = join(root, p);
      if (!existsSync(path)) return [p, null];
      if (realpathSync(path) !== path) return [p, 'symlink-or-ancestor-link'];
      const st = lstatSync(path);
      return [
        p,
        st.isSymbolicLink()
          ? hash({ link: readlinkSync(path) })
          : st.isFile()
            ? hash({ mode: st.mode & 0o777, bytes: hash(readFileSync(path)) })
            : 'directory',
      ];
    }),
  );
}
const delta = (a, b) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p]).sort();
const covered = (path, scope) => scope.some((p) => path === p || path.startsWith(p + '/'));
// Between registration and settlement a Parent edit and a child edit look the same. Only changes
// inside the child's write scope count as the child's; any other change is unattributable.
function attributeChanges(paths, writeScope) {
  return {
    changedPaths: paths.filter((p) => covered(p, writeScope)),
    unattributable: paths
      .filter((p) => !covered(p, writeScope))
      .map((p) => `unattributable-change:${p}`),
  };
}
function markInvalid(dir, reason) {
  try {
    writeFileSync(join(dir, 'observation-error.json'), JSON.stringify({ reason }), {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
function writerPath(root) {
  return resolveArtifactPath(root, ['claude-native', 'writer.json'], {});
}
function releaseWriter(root, taskId) {
  const path = writerPath(root);
  if (existsSync(path) && jsonFile(path).taskId === taskId) unlinkSync(path);
}
function responseErrors(record, r) {
  const errors = [];
  if (!r || r.status !== 'completed' || typeof r.agentId !== 'string' || !r.agentId)
    errors.push('incomplete-child');
  if (r?.resolvedModel !== record.expectedResolvedModel) errors.push('effective-model-mismatch');
  if (
    r?.modelsUsed !== undefined &&
    (!Array.isArray(r.modelsUsed) ||
      !r.modelsUsed.length ||
      !r.modelsUsed.every((m) => m === record.expectedResolvedModel))
  )
    errors.push('model-changed');
  if (!Array.isArray(r?.content) || !r.content.length) errors.push('missing-child-content');
  return errors;
}
function localIdentity(root, role) {
  const source = ['claude', 'common'].flatMap((owner) => {
    const dir = resolve(ownDirectory, '..', owner);
    return readdirSync(dir)
      .filter((p) => p.endsWith('.mjs'))
      .sort()
      .map((p) => [owner + '/' + p, hash(readFileSync(join(dir, p)))]);
  });
  const rolePath = join(root, '.claude/agents', role + '.md');
  check(realpathSync(rolePath) === rolePath, 'role symlink');
  const config = ['.claude/settings.json', '.claude/settings.local.json'].map((p) => [
    p,
    existsSync(join(root, p)) ? hash(readFileSync(join(root, p))) : null,
  ]);
  return {
    sourceDigest: hash(source),
    configDigest: hash({ role: hash(readFileSync(rolePath)), config }),
  };
}
// A review built by the task helper binds its result template, including the runner records, into
// the registered prompt on the line starting with this prefix.
export const REVIEW_RESULT_TEMPLATE_PREFIX = 'Result template: ';
function boundRunnerRecords(prompt) {
  const line = prompt.split('\n').find((l) => l.startsWith(REVIEW_RESULT_TEMPLATE_PREFIX));
  if (line === undefined) return undefined;
  try {
    return JSON.parse(line.slice(REVIEW_RESULT_TEMPLATE_PREFIX.length)).commandsActuallyRun ?? null;
  } catch {
    return null;
  }
}
// model-policy owns the decision and reports malformed input only as `invalid-input`. These checks
// mirror its input rules so a refusal names the field; they never admit what the policy refuses.
const SAFE_REF = /^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,299}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const safeRef = (value) =>
  typeof value === 'string' &&
  SAFE_REF.test(value) &&
  !value.includes('//') &&
  value.split('/').every((segment) => segment !== '.' && segment !== '..');
const safePath = (value) =>
  typeof value === 'string' &&
  !value.startsWith('/') &&
  !value.endsWith('/') &&
  value.split('/').every((segment) => /^(?!\.{1,2}$)[a-zA-Z0-9._-]+$/u.test(segment));
export function nativeRequestIssues(nativeRequest) {
  const issues = [];
  const { issuedAt, expiresAt, selectionBasisRef, task } = nativeRequest ?? {};
  const start = ISO_UTC.test(issuedAt ?? '') ? Date.parse(issuedAt) : NaN;
  const end = ISO_UTC.test(expiresAt ?? '') ? Date.parse(expiresAt) : NaN;
  if (!(start < end)) issues.push('invalid-binding-interval');
  else if (end - start > 30 * 60 * 1000) issues.push('binding-lifetime-exceeds-30m');
  if (!safeRef(selectionBasisRef)) issues.push('unsafe-reference:nativeRequest.selectionBasisRef');
  const keys = new Set();
  for (const [index, fact] of (Array.isArray(task?.facts) ? task.facts : []).entries()) {
    if (!safeRef(fact?.sourceRef))
      issues.push(`unsafe-reference:nativeRequest.task.facts[${index}].sourceRef`);
    if (fact?.confidence !== 'high') issues.push(`fact-confidence-not-high:${fact?.key}`);
    if (keys.has(fact?.key)) issues.push(`duplicate-fact:${fact?.key}`);
    keys.add(fact?.key);
  }
  for (const field of ['readScope', 'writeScope'])
    for (const path of Array.isArray(task?.[field]) ? task[field] : [])
      if (!safePath(path)) issues.push(`unsafe-path:nativeRequest.task.${field}:${path}`);
  return issues;
}
function notReadyReasons(workflow, nativeRequest) {
  const profile = workflow.native.profileAssessment?.reasons ?? [];
  const issues = profile.includes('invalid-input') ? nativeRequestIssues(nativeRequest) : [];
  return [
    workflow.gaps.join(','),
    ...(profile.length ? [`profile: ${profile.join(',')}`] : []),
    ...(issues.length ? [`input: ${issues.join(',')}`] : []),
  ].join('; ');
}
function baseline(root) {
  const p = runClaudePreflight({ root, mode: 'fresh' });
  check(p.diagnostics.length === 0, `unobservable source: ${p.diagnostics.join(',')}`);
  return {
    baseSHA: p.baseline.head,
    headSHA: p.baseline.head,
    dirtyDiffDigest: p.baseline.clean ? null : `sha256:${p.baseline.diffHash}`,
    untrackedInputDigests: p.baseline.untrackedInputDigests,
  };
}

// A bound retry keeps these task facts of its first task; only the prompt may add failure evidence.
function recoveryFacts(input) {
  const task = input?.nativeRequest?.task ?? {};
  return {
    request: input?.request,
    kind: task.kind,
    impactRisk: task.impactRisk,
    complexity: task.complexity,
    uncertainty: task.uncertainty,
    childValue: task.childValue,
    owner: input?.directAssignment?.owner,
    readScope: task.readScope,
    writeScope: task.writeScope,
    acceptance: input?.directAssignment?.acceptance,
    reviewDisposition: input?.reviewDisposition,
    facts: task.facts,
  };
}
const RECOVERY_CAUSES = ['result-error', 'omission', 'context-missing'];
// One bound retry per session and fact set. The marker is created exclusively, so a duplicate first
// task with the same facts shares the same retry.
// Key order must not split one fact set into two markers: the facts compare with isDeepStrictEqual.
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
function recoveryMarkerPath(root, sessionId, facts) {
  const dir = resolveArtifactPath(root, ['claude-native', 'recovery', sessionId], {});
  return { dir, path: join(dir, `${hash(canonical(facts)).slice(7)}.json`) };
}
// Read-only. Reasons come in a fixed order so each can be seen on its own; nothing is written here.
function bindRecovery(root, sessionId, workflowInput, recovery) {
  exact(recovery, ['of', 'cause'], 'recovery-format');
  check(typeof recovery.of === 'string' && uuid.test(recovery.of), 'recovery-format');
  check(RECOVERY_CAUSES.includes(recovery.cause), `recovery-cause: ${recovery.cause}`);
  let first;
  try {
    first = loadTask(root, recovery.of);
  } catch {
    throw new TypeError('recovery-not-bound: first task not found');
  }
  const { dir, record } = first;
  const facts = recoveryFacts(workflowInput);
  check(record.sessionId === sessionId, 'recovery-not-bound: first task is from another session');
  check(
    isDeepStrictEqual(recoveryFacts(record.input), facts),
    'recovery-not-bound: task facts differ from the first task',
  );
  const firstTask = record.input.nativeRequest.task;
  check(firstTask.recovery === undefined, 'recovery-chain: the first task is itself a retry');
  const from = {
    profileId: record.input.nativeRequest.profileId,
    role: firstTask.role,
    kind: firstTask.kind,
  };
  const step = claudeRecoveryStep(from, {
    profileId: workflowInput?.nativeRequest?.profileId,
    role: workflowInput?.nativeRequest?.task?.role,
    kind: workflowInput?.nativeRequest?.task?.kind,
  });
  check(
    recovery.cause === 'context-missing' ? step === 0 : step === 1 || step === 2,
    `recovery-step: ${recovery.cause} cannot move from ${from.profileId}/${from.role} to this task`,
  );
  // A superseded first task is the result of its used retry, so it is reported as used, even when
  // the retry has since changed files the first task observed.
  const superseded = existsSync(join(dir, 'recovery.json'));
  const marker = recoveryMarkerPath(root, sessionId, facts);
  check(!superseded, 'recovery-used: this work item already used its one bound retry');
  const state = currentObservation(first);
  const errors = state.errors;
  check(
    existsSync(join(dir, 'attempt.json')) &&
      state.observation.valid === true &&
      errors.length === 0 &&
      (record.expectedResolvedModel.startsWith('claude-haiku-') ||
        isDeepStrictEqual(state.observedEfforts, [record.expectedEffort])),
    `recovery-not-ran: the first task must have run and be observed valid with its effort (${errors.join(',') || 'invalid observation'})`,
  );
  check(!existsSync(join(dir, 'accepted.json')), 'recovery-accepted: the first task was accepted');
  check(!existsSync(marker.path), 'recovery-used: this work item already used its one bound retry');
  return {
    value: {
      of: recovery.of,
      cause: recovery.cause,
      step,
      fromProfileId: from.profileId,
      fromRole: from.role,
    },
    firstDirectory: dir,
    marker,
  };
}
export function registerClaudeNativeTask({
  workflowInput,
  sessionId,
  prompt,
  expectedResolvedModel,
  independentReview,
  recovery,
} = {}) {
  check(uuid.test(sessionId), 'current SessionStart session_id required');
  check(
    typeof prompt === 'string' &&
      prompt.length > 0 &&
      prompt.length <= 12000 &&
      !prompt.includes('KNU_NATIVE_TASK:'),
    'bounded prompt required',
  );
  check(
    /^claude-(haiku|sonnet|opus)-[a-zA-Z0-9._-]+$/u.test(expectedResolvedModel),
    'exact expected model required',
  );
  const root = realpathSync(workflowInput?.root ?? process.cwd());
  const role = workflowInput?.nativeRequest?.task?.role;
  check(
    [
      'knu_explorer',
      'knu_researcher',
      'knu_executor',
      'knu_executor_xhigh',
      'knu_reviewer',
    ].includes(role),
    'unknown repository role',
  );
  const bound =
    recovery === undefined ? null : bindRecovery(root, sessionId, workflowInput, recovery);
  const given = workflowInput?.nativeRequest?.task?.recovery;
  check(
    given === undefined || (bound !== null && isDeepStrictEqual(given, bound.value)),
    'recovery-unregistered: only the registry writes task.recovery',
  );
  if (bound !== null)
    workflowInput = {
      ...workflowInput,
      nativeRequest: {
        ...workflowInput.nativeRequest,
        task: { ...workflowInput.nativeRequest.task, recovery: bound.value },
      },
    };
  const identity = localIdentity(root, role);
  const input = {
    ...workflowInput,
    root,
    nativeMode: 'interactive-auto',
    adapterIdentity: identity,
    currentSnapshot: workflowInput.currentSnapshot ?? baseline(root),
  };
  const workflow = prepareClaudeWorkflow(input),
    binding = workflow.native.binding;
  check(
    workflow.native.requestStatus === 'eligible' && workflow.gaps.length === 0,
    `workflow not ready: ${notReadyReasons(workflow, input.nativeRequest)}`,
  );
  check(
    Date.now() >= Date.parse(binding.issuedAt) && Date.now() <= Date.parse(binding.expiresAt),
    'expired binding',
  );
  check(
    expectedResolvedModel.startsWith(`claude-${binding.requestedModelAlias}-`),
    'expected model/profile mismatch',
  );
  check(
    isDeepStrictEqual(input.directAssignment.writeOwnership, binding.writeScope),
    'lane/task ownership mismatch',
  );
  check(
    !binding.writeOwner || binding.writeOwner === input.directAssignment.owner,
    'writer mismatch',
  );
  let reviewBinding = null;
  if (independentReview !== undefined) {
    exact(
      independentReview,
      ['subjectTaskId', 'reviewerId', 'builderIds', 'packet'],
      'invalid independent review registration',
    );
    const subject = loadTask(root, independentReview.subjectTaskId);
    check(!subject.record.independentReview, 'reviewer-of-reviewer is not supported');
    const subjectState = currentObservation(subject);
    check(
      subjectState.errors.length === 0,
      `completed subject observation required: ${subjectState.errors.join(',')}`,
    );
    const subjectObservation = subjectState.observation;
    check(
      role === 'knu_reviewer' &&
        binding.taskKind === 'review' &&
        binding.writeScope.length === 0 &&
        binding.writeOwner === null,
      'independent reviewer must be read-only knu_reviewer review',
    );
    check(
      input.directAssignment.owner === independentReview.reviewerId &&
        Array.isArray(independentReview.builderIds) &&
        independentReview.builderIds.length > 0 &&
        !independentReview.builderIds.includes(independentReview.reviewerId),
      'reviewer must be independent from builders',
    );
    // A read-only reviewer cannot attest its own commandsActuallyRun as runner evidence.
    check(
      independentReview.packet?.authority?.runnerOwner !== independentReview.reviewerId,
      'read-only reviewer cannot be the packet runner',
    );
    check(
      independentReview.packet?.objective === subject.record.requestSummary,
      'review packet objective mismatch',
    );
    check(
      independentReview.packet?.authority?.writeOwner ===
        subject.record.input.directAssignment.owner &&
        independentReview.builderIds.includes(subject.record.input.directAssignment.owner),
      'review packet writer/builders mismatch',
    );
    check(
      isDeepStrictEqual(subjectObservation.finalSnapshot, input.currentSnapshot) &&
        isDeepStrictEqual(baseline(root), subjectObservation.finalSnapshot),
      'review subject source is not current',
    );
    const packet = deepFreeze(structuredClone(independentReview.packet));
    const packetValidation = validateCrossModelPacket(packet, {
      currentSnapshot: subjectObservation.finalSnapshot,
    });
    check(packetValidation.valid, packetValidation.errors.join('; '));
    check(
      packet.intent.direction === 'same-host-independent-review',
      'terminal reviewer requires same-host-independent-review direction',
    );
    check(packet.lifecycle.transport === 'native', 'terminal reviewer requires native transport');
    const allowedReadPaths = packet.boundaries.allowedReadPaths;
    check(
      allowedReadPaths.every((path) => covered(path, binding.readScope)),
      'packet read scope exceeds reviewer task scope',
    );
    const responsePath = subjectResponsePath(root, subject.record.taskId);
    if (subject.record.input.directAssignment.writeOwnership.length === 0) {
      check(
        allowedReadPaths.includes(responsePath),
        'read-only subject review needs its response artifact',
      );
      check(
        sameSubjectResponse(root, responsePath, subjectResponseText(subjectObservation)),
        'subject response artifact does not match the settled response',
      );
    } else
      check(
        !covered(responsePath, allowedReadPaths),
        'writer subject response is not review input',
      );
    // Only the bound read-only response artifact may be read from the native evidence directory.
    check(
      allowedReadPaths.every(
        (path) => path === responsePath || !isClaudeNativeEvidencePath(root, path),
      ),
      'native task evidence is not review input',
    );
    check(
      [
        ...subject.record.input.directAssignment.writeOwnership,
        ...subjectObservation.changedPaths,
      ].every((path) => covered(path, allowedReadPaths)),
      'review packet does not cover subject changes',
    );
    reviewBinding = deepFreeze({
      subjectTaskId: subject.record.taskId,
      reviewerId: independentReview.reviewerId,
      builderIds: [...independentReview.builderIds],
      packet,
      subjectRequestDigest: subject.record.requestDigest,
      subjectBindingDigest: subject.record.bindingDigest,
      subjectResponseDigest: subjectObservation.responseDigest,
      subjectFinalSnapshot: subjectObservation.finalSnapshot,
      subjectAcceptance: [...subject.record.input.directAssignment.acceptance],
    });
  }
  const roleText = readFileSync(join(root, '.claude/agents', role + '.md'), 'utf8');
  const header = /^---\n([\s\S]*?)\n---/u.exec(roleText)?.[1];
  check(header && new RegExp(`^name: ${role}$`, 'mu').test(header), 'project role mismatch');
  const declared = /^tools: (.+)$/mu
    .exec(header)?.[1]
    ?.split(',')
    .map((s) => s.trim());
  check(isDeepStrictEqual(declared, binding.allowedTools), 'project role tools mismatch');
  // The role file fixes the child's effort; observation compares the child transcript against it.
  const expectedEffort = /^effort: (\S+)$/mu.exec(header)?.[1];
  check(
    ROLE_EFFORTS.includes(expectedEffort),
    `invalid-role-effort: ${role} must declare effort ${ROLE_EFFORTS.join('|')}`,
  );
  // Extraction skips independent QA only in the low-risk, bounded, resolved range, on any profile:
  // its required facts already demand a fixed input, one step and an independent check.
  const boundedExtraction =
    binding.taskKind === 'extract' &&
    binding.impactRisk === 'low' &&
    binding.complexity === 'bounded' &&
    binding.uncertainty === 'resolved';
  check(
    boundedExtraction || input.reviewDisposition.required === true || Boolean(reviewBinding),
    'independent QA required for this profile',
  );
  const taskId = randomUUID();
  const record = {
    version: 1,
    taskId,
    sessionId,
    root,
    input,
    prompt,
    expectedResolvedModel,
    expectedEffort,
    bindingDigest: binding.bindingDigest,
    requestDigest: workflow.requestDigest,
    requestSummary: workflow.envelope.requestSummary,
    independentReview: reviewBinding,
    initialFiles: inventory(root, binding.readScope),
  };
  const digest = hash(record);
  const invocation = {
    description: 'Repository bounded task',
    subagent_type: role,
    model: binding.requestedModelAlias,
    prompt: registeredPrompt(record, digest),
  };
  // Every other check has passed: claim the work item's retry, point the first task at this one,
  // then supersede the first task so it can no longer complete.
  if (bound !== null) {
    ensureLocalDirectory(root, bound.marker.dir);
    try {
      writeFileSync(bound.marker.path, JSON.stringify({ of: bound.value.of, taskId }), {
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      if (error.code === 'EEXIST')
        throw new TypeError('recovery-used: this work item already used its one bound retry');
      throw error;
    }
    writeFileSync(join(bound.firstDirectory, 'recovery.json'), JSON.stringify({ taskId }), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  const dir = taskDirectory(root, taskId);
  ensureLocalDirectory(root, dir);
  writeFileSync(join(dir, 'task.json'), JSON.stringify({ record, invocation }), {
    flag: 'wx',
    mode: 0o600,
  });
  if (bound !== null) markInvalid(bound.firstDirectory, 'superseded-by-recovery');
  return {
    taskId,
    invocation,
    agentInput: agentInputOf(invocation),
    workflow,
    evidenceDirectory: dir,
    dispatchAuthorized: false,
  };
}

function loadTask(root, id) {
  const dir = taskDirectory(root, id);
  check(realpathSync(dir) === dir, 'task path symlink');
  const { record, invocation } = jsonFile(join(dir, 'task.json'));
  check(record.version === 1 && record.taskId === id && record.root === root, 'foreign task');
  check(marker.exec(invocation.prompt)?.[2] === hash(record), 'task digest mismatch');
  return { dir, record, invocation };
}
// A resumed child appends to its transcript, so a settled result no longer matches its proof.
function childTranscriptDrifted(dir, observation) {
  if (observation.completionSource !== 'SubagentStop+task-notification+transcript') return false;
  try {
    const proof = jsonFile(join(dir, 'transcript-proof.json'));
    check(
      proof.responseDigest === observation.responseDigest &&
        realpathSync(proof.path) === proof.path &&
        lstatSync(proof.path).size <= 4 * 1024 * 1024 &&
        hash(readFileSync(proof.path)) === proof.digest,
      'child resumed/transcript drift',
    );
    return false;
  } catch {
    return true;
  }
}
function currentObservation(task) {
  const { dir, record, invocation } = task;
  const errors = [];
  let observation;
  try {
    observation = jsonFile(join(dir, 'completion.json'));
  } catch {
    return {
      observation: { valid: false, errors: ['no-completion-observation'] },
      actualPaths: [],
      errors: ['no-completion-observation'],
    };
  }
  errors.push(...(observation.errors ?? []));
  if (existsSync(join(dir, 'observation-error.json'))) errors.push('observation-error');
  if (childTranscriptDrifted(dir, observation)) errors.push('child-transcript-drift-or-missing');
  let attempt;
  try {
    attempt = jsonFile(join(dir, 'attempt.json'));
  } catch {
    errors.push('missing-pretool');
  }
  if (
    observation.taskId !== record.taskId ||
    observation.bindingDigest !== record.bindingDigest ||
    observation.sessionId !== record.sessionId ||
    observation.toolUseId !== attempt?.toolUseId ||
    attempt?.sessionId !== record.sessionId ||
    observation.inputDigest !== inputHash(invocation) ||
    attempt?.inputDigest !== inputHash(invocation)
  )
    errors.push('foreign-completion');
  errors.push(...responseErrors(record, observation.response));
  if (observation.responseDigest !== hash(observation.response ?? null))
    errors.push('response-digest-mismatch');
  const finalFiles = inventory(record.root, record.input.nativeRequest.task.readScope);
  const { changedPaths: actualPaths, unattributable } = attributeChanges(
    delta(record.initialFiles, finalFiles),
    record.input.directAssignment.writeOwnership,
  );
  if (!isDeepStrictEqual(finalFiles, observation.finalFiles))
    errors.push('post-completion-file-drift');
  errors.push(...unattributable);
  if (!observation.valid) errors.push('native-observation-required');
  if (
    !isDeepStrictEqual(
      localIdentity(record.root, invocation.subagent_type),
      record.input.adapterIdentity,
    )
  )
    errors.push('adapter/role/settings drift');
  if (!isDeepStrictEqual(baseline(record.root), observation.finalSnapshot))
    errors.push('post-completion-source-drift');
  const effort = effortObservation(task, observation);
  errors.push(...effort.errors);
  return {
    observation,
    actualPaths,
    errors: [...new Set(errors)],
    observedEfforts: effort.observedEfforts,
  };
}
// The settled background transcript, or the location a foreground completion recorded.
function childTranscriptOf(dir, observation) {
  if (observation.completionSource !== 'SubagentStop+task-notification+transcript')
    return observation.childTranscriptPath ?? null;
  try {
    return jsonFile(join(dir, 'transcript-proof.json')).path;
  } catch {
    return null;
  }
}
// Judged on every observation, so a transcript the host writes after completion is still read.
// Pending turns into unobserved once the task lifetime ends; Haiku has no effort to compare.
function effortObservation({ dir, record, invocation }, observation) {
  if (!observation.valid) return { errors: [], observedEfforts: [] };
  const agentId = observation.agentId;
  const path = childTranscriptOf(dir, observation);
  let read;
  if (path === null) read = { status: 'pending' };
  else if (
    typeof path !== 'string' ||
    !path.endsWith(`/${record.sessionId}/subagents/agent-${agentId}.jsonl`)
  )
    read = { status: 'foreign' };
  else if (!existsSync(path)) read = { status: 'pending' };
  else {
    try {
      const stat = lstatSync(path);
      check(
        realpathSync(path) === path && stat.isFile() && stat.size <= 4 * 1024 * 1024,
        'child transcript path/size',
      );
      read = readClaudeTranscriptEfforts(readFileSync(path), {
        sessionId: record.sessionId,
        agentId,
        prompt: invocation.prompt,
        expectedModel: record.expectedResolvedModel,
      });
    } catch {
      read = { status: 'foreign' };
    }
  }
  const observedEfforts = read.efforts ?? [];
  if (read.status === 'foreign') return { errors: ['effort-transcript-foreign'], observedEfforts };
  if (read.status === 'pending') {
    const ended = Date.now() > Date.parse(record.input.nativeRequest.expiresAt);
    return { errors: [ended ? 'effort-unobserved' : 'effort-transcript-pending'], observedEfforts };
  }
  if (record.expectedResolvedModel.startsWith('claude-haiku-'))
    return { errors: [], observedEfforts };
  if (read.missing) return { errors: ['effort-unobserved'], observedEfforts };
  if (!isDeepStrictEqual(observedEfforts, [record.expectedEffort]))
    return { errors: ['effort-mismatch'], observedEfforts };
  return { errors: [], observedEfforts };
}
function associated(event, task, expectedInput = task.invocation) {
  const { record, invocation } = task;
  check(
    event.session_id === record.sessionId && realpathSync(event.cwd) === record.root,
    'foreign session/root',
  );
  check(event.permission_mode === 'auto', 'expected auto permission mode');
  check(typeof event.tool_use_id === 'string' && event.tool_use_id.length > 0, 'missing tool id');
  check(isDeepStrictEqual(event.tool_input, expectedInput), 'native input/model mismatch');
  check(
    isDeepStrictEqual(
      localIdentity(record.root, invocation.subagent_type),
      record.input.adapterIdentity,
    ),
    'adapter/role/settings drift',
  );
}
function saveCompletion(task, attempt, r, completionSource, childTranscriptPath = null) {
  const { dir, record, invocation } = task,
    root = record.root;
  const errors = responseErrors(record, r);
  if (r?.status === 'completed' && !CHILD_ID.test(r.agentId ?? ''))
    errors.push('invalid-child-identity');
  if (r?.agentType !== undefined && r.agentType !== invocation.subagent_type)
    errors.push('role-mismatch');
  if (r?.prompt !== undefined && r.prompt !== invocation.prompt) errors.push('prompt-mismatch');
  const finalFiles = inventory(root, record.input.nativeRequest.task.readScope);
  const { changedPaths, unattributable } = attributeChanges(
    delta(record.initialFiles, finalFiles),
    record.input.directAssignment.writeOwnership,
  );
  errors.push(...unattributable);
  const observation = {
    completionSource,
    valid: errors.length === 0,
    errors,
    taskId: record.taskId,
    bindingDigest: record.bindingDigest,
    inputDigest: inputHash(invocation),
    response: r,
    finalFiles,
    changedPaths,
    sessionId: record.sessionId,
    toolUseId: attempt.toolUseId,
    agentId: r?.agentId ?? null,
    resolvedModel: r?.resolvedModel ?? null,
    responseDigest: hash(r ?? null),
    content: r?.content ?? null,
    childTranscriptPath,
    finalSnapshot: baseline(root),
    verificationClass: 'local-hook-observation-not-authentication',
  };
  writeFileSync(join(dir, 'completion.json'), JSON.stringify(observation), {
    flag: 'wx',
    mode: 0o600,
  });
  return observation;
}

const PARENT_TRANSCRIPT_LIMIT = 128 * 1024 * 1024;
// A long Lead session's transcript grows well past a few MiB. Only rows mentioning a needle are
// parsed, so the cap bounds resources and an unrelated malformed row neither hides nor fakes them.
function parentTranscriptRows(path, sessionId, needles) {
  check(
    typeof path === 'string' &&
      path.endsWith(`/${sessionId}.jsonl`) &&
      realpathSync(path) === path &&
      lstatSync(path).size <= PARENT_TRANSCRIPT_LIMIT,
    'parent transcript unavailable/oversized',
  );
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => needles.some((needle) => line.includes(needle)))
    .map((line) => JSON.parse(line));
}
function settleStoppedTask(task) {
  const { dir, record, invocation } = task;
  if (existsSync(join(dir, 'completion.json'))) return;
  const launch = jsonFile(join(dir, 'launch.json')),
    stop = jsonFile(join(dir, 'stop.json')),
    attempt = jsonFile(join(dir, 'attempt.json'));
  check(
    stop.session_id === record.sessionId &&
      stop.agent_id === launch.response.agentId &&
      stop.agent_type === invocation.subagent_type &&
      launch.toolUseId === attempt.toolUseId &&
      attempt.inputDigest === inputHash(invocation),
    'stop association mismatch',
  );
  const path = stop.agent_transcript_path;
  check(
    typeof path === 'string' &&
      path.endsWith(`/${record.sessionId}/subagents/agent-${stop.agent_id}.jsonl`) &&
      realpathSync(path) === path,
    'unexpected transcript path',
  );
  const stat = lstatSync(path);
  check(stat.isFile() && stat.size <= 4 * 1024 * 1024, 'transcript byte limit');
  const parentRows = parentTranscriptRows(stop.transcript_path, record.sessionId, [stop.agent_id]);
  check(
    parentRows.some((row) =>
      isClaudeCompletedNotification(row, {
        sessionId: record.sessionId,
        agentId: stop.agent_id,
        toolUseId: attempt.toolUseId,
      }),
    ),
    'matching task completion notification required',
  );
  const bytes = readFileSync(path);
  const r = readClaudeStoppedTranscript(bytes, {
    sessionId: record.sessionId,
    agentId: stop.agent_id,
    prompt: invocation.prompt,
    expectedModel: record.expectedResolvedModel,
  });
  const observation = saveCompletion(task, attempt, r, 'SubagentStop+task-notification+transcript');
  writeFileSync(
    join(dir, 'transcript-proof.json'),
    JSON.stringify({ path, digest: hash(bytes), responseDigest: observation.responseDigest }),
    { flag: 'wx', mode: 0o600 },
  );
  releaseWriter(record.root, record.taskId);
}
// Report missing completion, not a fabricated success, and name why the recorded Stop did not settle.
function settleIfStopped(task) {
  if (!existsSync(join(task.dir, 'stop.json')) || existsSync(join(task.dir, 'completion.json')))
    return [];
  try {
    settleStoppedTask(task);
    return [];
  } catch (error) {
    return [`stopped-task-settlement-failed: ${error.message}`];
  }
}
// Hook paths that look up this session's children skip a task they cannot trust (copied from another
// checkout, symlinked, damaged). Completion still loads each task strictly and refuses such records.
function readableTasks(root, base) {
  const tasks = [];
  for (const id of readdirSync(base).filter((id) => uuid.test(id))) {
    try {
      tasks.push(loadTask(root, id));
    } catch {
      continue;
    }
  }
  return tasks;
}
function launchedAgentId(task) {
  try {
    return jsonFile(join(task.dir, 'launch.json')).response?.agentId;
  } catch {
    return undefined;
  }
}
function stopped(event, root) {
  check(
    uuid.test(event.session_id) &&
      typeof event.agent_id === 'string' &&
      /^[a-zA-Z0-9_-]{1,80}$/u.test(event.agent_id) &&
      realpathSync(event.cwd) === root,
    'invalid stop identity',
  );
  const base = resolveArtifactPath(root, ['claude-native'], {});
  if (!existsSync(base)) return {};
  const pendingDir = join(base, 'pending-stops');
  ensureLocalDirectory(root, pendingDir);
  const pendingPath = join(pendingDir, `${event.session_id}-${event.agent_id}.json`);
  if (!existsSync(pendingPath))
    writeFileSync(pendingPath, JSON.stringify(event), { flag: 'wx', mode: 0o600 });
  const matches = readableTasks(root, base).filter(
    (task) =>
      task.record.sessionId === event.session_id &&
      existsSync(join(task.dir, 'launch.json')) &&
      launchedAgentId(task) === event.agent_id,
  );
  check(matches.length <= 1, 'ambiguous child association');
  if (!matches.length) return {}; // Another role/task is not silently assigned to the newest registration.
  const task = matches[0];
  check(event.agent_type === task.invocation.subagent_type, 'foreign stop role');
  if (existsSync(join(task.dir, 'stop.json'))) {
    const prior = jsonFile(join(task.dir, 'stop.json'));
    check(
      prior.agent_id === event.agent_id &&
        prior.session_id === event.session_id &&
        prior.agent_transcript_path === event.agent_transcript_path,
      'changed stop association',
    );
    return {};
  }
  writeFileSync(
    join(task.dir, 'stop.json'),
    JSON.stringify({
      session_id: event.session_id,
      agent_id: event.agent_id,
      agent_type: event.agent_type,
      agent_transcript_path: event.agent_transcript_path,
      transcript_path: event.transcript_path,
    }),
    { flag: 'wx', mode: 0o600 },
  );
  try {
    settleStoppedTask(task);
  } catch {
    /* Transcript can flush after hook; complete retries the exact recorded stop only. */
  }
  return {};
}
const deny = (reason) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `KNU native task: ${reason}`,
  },
});
// A file that may not exist yet resolves through its nearest existing ancestor. Null means the
// target is outside the repository or is the repository itself.
function repositoryPath(root, absolute) {
  const rest = [];
  let existing = absolute;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return null;
    rest.unshift(basename(existing));
    existing = parent;
  }
  const path = relative(root, join(realpathSync(existing), ...rest));
  return !path || path === '..' || path.startsWith('../') || isAbsolute(path) ? null : path;
}
// Edit, Write and NotebookEdit guard. It denies only a subagent writing native evidence, and this
// session's main thread writing a tracked or non-ignored path while its writer task holds the lease.
// It never allows. Bash and other tools do not reach it, and a missing or failed hook lets the
// write through, so the collector still refuses unattributable changes at settlement.
export function guardClaudeNativeFileWrite(event, { root = process.cwd() } = {}) {
  const input = event?.tool_input ?? {};
  const target = event?.tool_name === 'NotebookEdit' ? input.notebook_path : input.file_path;
  if (typeof target !== 'string' || !target) return {};
  root = realpathSync(root);
  const base = typeof event.cwd === 'string' && isAbsolute(event.cwd) ? event.cwd : root;
  const path = repositoryPath(root, resolve(base, target));
  if (path === null) return {};
  if (event.agent_id)
    return isClaudeNativeEvidencePath(root, path)
      ? deny('native evidence is written by the hook and helper only')
      : {};
  const lease = writerPath(root);
  if (!existsSync(lease)) return {};
  const { taskId, sessionId } = jsonFile(lease);
  check(typeof taskId === 'string' && typeof sessionId === 'string', 'invalid writer lease');
  if (sessionId !== event.session_id) return {};
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', path], {
    timeout: 5000,
  });
  if (ignored.status === 0) return {};
  check(ignored.status === 1, 'git check-ignore failed');
  return deny(
    `Parent write during active writer task ${taskId}: settle it first, or after the child ended run pnpm claude:native release --task ${taskId} --ended`,
  );
}
export function handleClaudeNativeSessionEvent(event, { root = process.cwd() } = {}) {
  root = realpathSync(root);
  if (event?.hook_event_name === 'SubagentStop') return stopped(event, root);
  if (event?.hook_event_name === 'PreToolUse' && event.tool_name === 'SendMessage') {
    const base = resolveArtifactPath(root, ['claude-native'], {});
    if (existsSync(base))
      for (const task of readableTasks(root, base)) {
        if (task.record.sessionId !== event.session_id) continue;
        // A background launch and a foreground completion both bind the child; neither may resume.
        const bound = ['launch.json', 'completion.json']
          .filter((file) => existsSync(join(task.dir, file)))
          .map((file) => {
            try {
              return jsonFile(join(task.dir, file)).response?.agentId;
            } catch {
              return undefined;
            }
          });
        if (bound.includes(event.tool_input?.to))
          return deny('bound child resume requires a new registered Agent task');
      }
    return {};
  }

  if (event?.hook_event_name === 'SessionStart') {
    check(uuid.test(event.session_id) && realpathSync(event.cwd) === root, 'invalid session');
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `KNU native session_id=${event.session_id}. Start with claude --permission-mode auto. For repository knu_* delegation use /knu-delegate, /knu-review and /knu-settle, and read docs/development/agent-workflows/adapters/claude-code.md; the skills register a bounded task with pnpm claude:native prepare --spec <JSON file>, then call Agent with the returned agentInput (the hook injects the registered prompt). Registration is not permission approval. Existing OMC roles keep their own policy; do not substitute them for a required KNU role. Missing/error hook is not fail-closed; verify completion receipts and semantic QA.`,
      },
    };
  }
  if (
    !['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].includes(event?.hook_event_name) ||
    event.tool_name !== 'Agent'
  )
    return {};
  const prompt = typeof event.tool_input?.prompt === 'string' ? event.tool_input.prompt : '';
  // Only PreToolUse accepts the short input; afterwards Claude reports the injected invocation.
  const short = event.hook_event_name === 'PreToolUse' && shortMarker.exec(prompt);
  const match = marker.exec(prompt) ?? short;
  const managed =
    event.tool_input?.subagent_type?.startsWith('knu_') ||
    event.tool_input?.prompt?.includes('KNU_NATIVE_TASK:');
  if (!managed) return {}; // OMC/native unrelated roles retain their own contract.
  let acquiredWriter = false;
  let currentTask;
  let terminalObserved = false;
  try {
    check(match, 'registered task required');
    const task = loadTask(root, match[1]),
      { dir, record } = task;
    // The injected prompt comes from task.json, so it must still be the one the record digest binds;
    // a full-input caller would notice an edited body, a short-input caller cannot.
    if (short) {
      // The whole stored invocation is injected, so it may not carry keys the Lead never saw.
      exact(task.invocation, Object.keys(agentInputOf(task.invocation)), 'task digest mismatch');
      check(
        task.invocation.prompt === registeredPrompt(record, hash(record)) &&
          task.invocation.subagent_type === record.input.nativeRequest.task.role,
        'task digest mismatch',
      );
    }
    // A short input goes through the same checks; only the expected tool input differs.
    associated(event, task, short ? agentInputOf(task.invocation) : task.invocation);
    currentTask = task;
    if (event.hook_event_name === 'PreToolUse') {
      check(
        !(
          process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE === '1' &&
          process.env.CLAUDE_CODE_SUBAGENT_MODEL &&
          ![task.invocation.model, record.expectedResolvedModel].includes(
            process.env.CLAUDE_CODE_SUBAGENT_MODEL,
          )
        ),
        'conflicting ambient forced model',
      );
      const workflow = prepareClaudeWorkflow(record.input);
      check(
        workflow.gaps.length === 0 &&
          workflow.native.binding?.bindingDigest === record.bindingDigest,
        'stale workflow',
      );
      const b = workflow.native.binding;
      check(
        Date.now() >= Date.parse(b.issuedAt) && Date.now() <= Date.parse(b.expiresAt),
        'expired binding',
      );
      check(
        isDeepStrictEqual(inventory(root, b.readScope), record.initialFiles),
        'input file drift',
      );
      check(!existsSync(join(dir, 'attempt.json')), 'task already attempted');
      const bound = record.input.nativeRequest.task.recovery;
      if (bound !== undefined) {
        let pointer = null;
        try {
          pointer = jsonFile(join(taskDirectory(root, bound.of), 'recovery.json')).taskId;
        } catch {
          pointer = null;
        }
        check(pointer === record.taskId, 'recovery binding mismatch');
      }
      if (b.writeScope.length) {
        writeFileSync(
          writerPath(root),
          JSON.stringify({ taskId: record.taskId, sessionId: record.sessionId }),
          { flag: 'wx', mode: 0o600 },
        );
        acquiredWriter = true;
      }
      writeFileSync(
        join(dir, 'attempt.json'),
        JSON.stringify({
          sessionId: event.session_id,
          toolUseId: event.tool_use_id,
          // PostToolUse reports the invocation, whether it was sent in full or injected.
          inputDigest: inputHash(task.invocation),
          // Lets review closure check this session's transcript for calls the hooks missed.
          transcriptPath: typeof event.transcript_path === 'string' ? event.transcript_path : null,
        }),
        { flag: 'wx', mode: 0o600 },
      );
      // No allow: auto classifier/other permissions still decide.
      return short
        ? { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: task.invocation } }
        : {};
    }
    const attempt = jsonFile(join(dir, 'attempt.json'));
    check(
      attempt.sessionId === event.session_id &&
        attempt.toolUseId === event.tool_use_id &&
        attempt.inputDigest === inputHash(event.tool_input),
      'missing/foreign pretool observation',
    );
    const r =
      event.hook_event_name === 'PostToolUseFailure' ? { status: 'failed' } : event.tool_response;
    terminalObserved = event.hook_event_name === 'PostToolUseFailure' || r?.status === 'completed';
    if (r?.status === 'async_launched') {
      check(
        typeof r.agentId === 'string' && CHILD_ID.test(r.agentId),
        'missing async child identity',
      );
      check(
        r.resolvedModel === record.expectedResolvedModel,
        `async launch model mismatch: expected ${record.expectedResolvedModel}, observed ${r.resolvedModel}`,
      );
      check(r.prompt === task.invocation.prompt, 'async launch prompt mismatch');
      writeFileSync(
        join(dir, 'launch.json'),
        JSON.stringify({ response: r, sessionId: record.sessionId, toolUseId: attempt.toolUseId }),
        { flag: 'wx', mode: 0o600 },
      );
      const pending = resolveArtifactPath(
        root,
        ['claude-native', 'pending-stops', `${record.sessionId}-${r.agentId}.json`],
        {},
      );
      if (existsSync(pending)) stopped(jsonFile(pending), root);
      return {}; // Native auto dispatch is asynchronous; this is not completion.
    }
    // A foreground child's transcript sits beside the parent's; only its location is recorded here,
    // since the host may still be writing it. Observation reads it at settle/complete.
    const childTranscript =
      r?.status === 'completed' &&
      CHILD_ID.test(r.agentId ?? '') &&
      typeof event.transcript_path === 'string' &&
      isAbsolute(event.transcript_path)
        ? join(
            dirname(event.transcript_path),
            record.sessionId,
            'subagents',
            `agent-${r.agentId}.jsonl`,
          )
        : null;
    const observation = saveCompletion(task, attempt, r, event.hook_event_name, childTranscript);
    const errors = observation.errors;
    if (terminalObserved) releaseWriter(root, record.taskId);
    return {
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: `KNU task ${record.taskId}: ${observation.valid ? 'child completed; effort, semantic acceptance and QA are judged at settle' : 'NOT COMPLETE: ' + errors.join(',')}. Evidence ${dir}/completion.json. Complete with pnpm claude:native complete --task ${record.taskId} --input <result JSON>.`,
      },
    };
  } catch (error) {
    if (acquiredWriter) releaseWriter(root, currentTask.record.taskId);
    if (currentTask && terminalObserved) {
      markInvalid(currentTask.dir, error.message);
      releaseWriter(root, currentTask.record.taskId);
    }
    if (event.hook_event_name === 'PreToolUse') return deny(error.message);
    return {
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: `KNU native result NOT VERIFIED: ${error.message}. Do not claim completion.`,
      },
    };
  }
}

// Hooks record one Agent call per reviewer task; a failed hook records none. The linked reviewer's
// settled parent transcript still shows every Agent call of that session and whether it returned
// only an error (a deny by any hook, rule or auto classifier). Any other call carrying a reviewer's
// marker is a review the hooks did not observe. An unreadable transcript blocks instead of passing.
function reviewAgentCalls(path, sessionId, ids) {
  const calls = parentTranscriptRows(
    path,
    sessionId,
    ids.map((id) => `KNU_NATIVE_TASK:${id}:`),
  ).flatMap((row) =>
    row?.type === 'assistant' && Array.isArray(row.message?.content)
      ? row.message.content
          .filter((c) => c?.type === 'tool_use' && c.name === 'Agent')
          .flatMap((c) =>
            ids
              .filter((id) => String(c.input?.prompt ?? '').includes(`KNU_NATIVE_TASK:${id}:`))
              .map((id) => ({ id, toolUseId: String(c.id) })),
          )
      : [],
  );
  if (!calls.length) return [];
  const results = parentTranscriptRows(
    path,
    sessionId,
    calls.map((call) => call.toolUseId),
  ).flatMap((row) =>
    row?.type === 'user' && Array.isArray(row.message?.content)
      ? row.message.content.filter((c) => c?.type === 'tool_result')
      : [],
  );
  // A call without a result is still in flight and counts as dispatched.
  return calls.map((call) => ({
    ...call,
    errored: results.some((r) => r.tool_use_id === call.toolUseId && r.is_error === true),
  }));
}
function reviewDispatchErrors(root, reviewerTaskId, recorded, unsettled) {
  const pending = (ids) =>
    ids.map((id) => `subject has an unsettled or released review attempt: ${id}`);
  let calls = [];
  try {
    const { dir, record } = loadTask(root, reviewerTaskId);
    const attempt = jsonFile(join(dir, 'attempt.json'));
    recorded = new Map(recorded).set(reviewerTaskId, {
      toolUseId: attempt.toolUseId,
      transcriptPath: existsSync(join(dir, 'stop.json'))
        ? jsonFile(join(dir, 'stop.json')).transcript_path
        : (attempt.transcriptPath ?? null),
      sessionId: record.sessionId,
    });
    // Every session transcript a reviewer attempt came from, including other sessions.
    const sources = new Map();
    for (const { transcriptPath, sessionId } of recorded.values())
      if (transcriptPath) sources.set(transcriptPath, sessionId);
    if (!sources.has(recorded.get(reviewerTaskId).transcriptPath)) return pending(unsettled); // Legacy attempt without a transcript: nothing to compare.
    for (const [path, sessionId] of sources)
      calls.push(...reviewAgentCalls(path, sessionId, [...recorded.keys()]));
  } catch (error) {
    return [`review dispatch check unavailable: ${error.message}`, ...pending(unsettled)];
  }
  const errors = [];
  for (const [id, { toolUseId }] of recorded)
    if (calls.some((c) => c.id === id && c.toolUseId !== toolUseId && !c.errored))
      errors.push(`subject has a review dispatch not observed by hooks: ${id}`);
  // A call refused after PreToolUse returns only an error and fires no Post event.
  errors.push(
    ...pending(
      unsettled.filter(
        (id) =>
          !calls.some(
            (c) => c.id === id && c.toolUseId === recorded.get(id).toolUseId && c.errored,
          ),
      ),
    ),
  );
  return errors;
}

export function completeClaudeNativeTask(
  id,
  { results = [], review, reviewerTaskId, reviewResult, responseDigest, acceptance = [] } = {},
  { root = process.cwd() } = {},
) {
  root = realpathSync(root);
  const task = loadTask(root, id),
    { dir, record, invocation } = task;
  const settlement = settleIfStopped(task);
  const currentState = currentObservation(task);
  const observation = currentState.observation;
  const errors = [...currentState.errors, ...settlement];
  const actualPaths = currentState.actualPaths;
  const reported = [...new Set(results.flatMap((r) => r.changedPaths ?? []))].sort();
  if (!isDeepStrictEqual(actualPaths, reported)) errors.push('reported-change-path-mismatch');
  if (responseDigest !== observation.responseDigest || !responseDigest)
    errors.push('same-response-semantic-check-required');
  for (const criterion of record.input.directAssignment.acceptance) {
    if (
      !acceptance.some(
        (a) =>
          a.criterion === criterion &&
          a.passed === true &&
          typeof a.evidenceRef === 'string' &&
          a.evidenceRef.trim(),
      )
    )
      errors.push(`semantic-acceptance-required:${criterion}`);
  }
  let linkedReview = review;
  let pendingReviewReceipt = null;
  if (
    !record.independentReview &&
    record.input.reviewDisposition.required === true &&
    reviewerTaskId === undefined
  )
    errors.push('native required QA requires linked reviewerTaskId');
  if (record.independentReview) {
    if (reviewerTaskId !== undefined || review !== undefined)
      errors.push('reviewer task cannot consume another review');
    let delivered;
    try {
      check(
        observation.response.content.length === 1 &&
          observation.response.content[0]?.type === 'text',
        'review response must contain one JSON text result',
      );
      delivered = JSON.parse(observation.response.content[0].text);
      check(
        delivered !== null && typeof delivered === 'object' && !Array.isArray(delivered),
        'review result must be a delivered JSON object',
      );
      check(
        isDeepStrictEqual(delivered, reviewResult),
        'review result differs from delivered JSON',
      );
    } catch (error) {
      errors.push(error.message);
    }
    if (delivered) {
      const namedModels = [delivered.identity?.resolvedModel, delivered.identity?.observedModel];
      if (namedModels.some((model) => model !== 'unknown' && model !== observation.resolvedModel))
        errors.push('review result model contradicts native observation');
      const verifiedResult = structuredClone(delivered);
      if (verifiedResult.identity) {
        verifiedResult.identity.resolvedModel = observation.resolvedModel;
        verifiedResult.identity.observedModel = observation.resolvedModel;
      }
      const qa = validateAdapterReview({
        reviewerId: record.independentReview.reviewerId,
        builderIds: record.independentReview.builderIds,
        packet: record.independentReview.packet,
        result: verifiedResult,
        currentSnapshot: observation.finalSnapshot,
      });
      errors.push(...qa.errors);
      if (delivered.status !== 'complete' || !['PASS', 'FAIL'].includes(delivered.verdict))
        errors.push('review result must be terminal complete PASS or FAIL');
      const runnerRecords = boundRunnerRecords(invocation.prompt);
      if (
        runnerRecords !== undefined &&
        !isDeepStrictEqual(delivered.commandsActuallyRun, runnerRecords)
      )
        errors.push('review commandsActuallyRun differs from the bound runner records');
      for (const criterion of record.independentReview.subjectAcceptance) {
        if (
          !delivered.acceptanceCoverage?.some(
            (item) => item?.criterion === criterion && item.gap === null,
          )
        )
          errors.push(`review coverage required:${criterion}`);
      }
      if (errors.length === 0) {
        pendingReviewReceipt = {
          reviewerTaskId: record.taskId,
          subjectTaskId: record.independentReview.subjectTaskId,
          subjectRequestDigest: record.independentReview.subjectRequestDigest,
          subjectBindingDigest: record.independentReview.subjectBindingDigest,
          subjectResponseDigest: record.independentReview.subjectResponseDigest,
          subjectFinalSnapshot: record.independentReview.subjectFinalSnapshot,
          reviewerBindingDigest: record.bindingDigest,
          reviewerResponseDigest: observation.responseDigest,
          reviewerFinalSnapshot: observation.finalSnapshot,
          reviewerResolvedModel: observation.resolvedModel,
          reviewerObservedEfforts: currentState.observedEfforts,
          reviewerId: record.independentReview.reviewerId,
          builderIds: record.independentReview.builderIds,
          packet: record.independentReview.packet,
          result: delivered,
        };
      }
    }
  } else if (reviewerTaskId !== undefined) {
    if (review !== undefined) errors.push('native reviewer link cannot override review payload');
    // Every dispatched review of this subject must end in PASS; a later PASS cannot hide another
    // reviewer's delivered or recorded non-PASS, and an unsettled attempt has no known verdict.
    const base = resolveArtifactPath(root, ['claude-native'], {});
    // Each same-subject reviewer and the Agent call id its PreToolUse recorded (null: none seen).
    const recorded = new Map();
    const unsettled = [];
    for (const otherId of readdirSync(base).filter((name) => uuid.test(name))) {
      if (otherId === reviewerTaskId) continue;
      let other;
      try {
        other = loadTask(root, otherId);
      } catch {
        errors.push(`unreadable native task: ${otherId}`);
        continue;
      }
      if (other.record.independentReview?.subjectTaskId !== record.taskId) continue;
      const receiptPath = join(other.dir, 'review-receipt.json');
      const completionPath = join(other.dir, 'completion.json');
      const attemptPath = join(other.dir, 'attempt.json');
      let attempt = null;
      try {
        if (existsSync(attemptPath)) attempt = jsonFile(attemptPath);
      } catch {
        errors.push(`unreadable native task: ${otherId}`);
        continue;
      }
      const recordedId = attempt?.toolUseId ?? null;
      recorded.set(otherId, {
        toolUseId: recordedId,
        transcriptPath: attempt?.transcriptPath ?? null,
        sessionId: other.record.sessionId,
      });
      // A settled review resumed later (for example SendMessage while hooks were down) may have
      // delivered a different verdict than the one recorded.
      if (existsSync(completionPath)) {
        let settled;
        try {
          settled = jsonFile(completionPath);
        } catch {
          errors.push(`unreadable native task: ${otherId}`);
          continue;
        }
        if (childTranscriptDrifted(other.dir, settled))
          errors.push(
            `subject has a review whose child transcript changed after settlement: ${otherId}`,
          );
      }
      if (existsSync(receiptPath)) {
        let verdict;
        try {
          verdict = jsonFile(receiptPath).result?.verdict;
        } catch {
          verdict = undefined;
        }
        if (verdict !== 'PASS') errors.push(`subject has a FAIL review receipt: ${otherId}`);
      } else if (recordedId === null) {
        continue; // Hooks saw no dispatch; missed dispatches are checked against the transcript.
      } else if (!existsSync(completionPath)) {
        unsettled.push(otherId);
      } else {
        let response;
        try {
          response = jsonFile(completionPath).response;
        } catch {
          response = undefined;
        }
        // A failed Agent tool call returned an error to the parent, never a verdict.
        if (response?.status === 'failed' && response.content === undefined) continue;
        let verdict;
        try {
          const content = response?.content;
          if (content?.length === 1 && content[0]?.type === 'text')
            verdict = JSON.parse(content[0].text)?.verdict;
        } catch {
          verdict = undefined;
        }
        if (verdict !== 'PASS') errors.push(`subject has a delivered non-PASS review: ${otherId}`);
      }
    }
    errors.push(...reviewDispatchErrors(root, reviewerTaskId, recorded, unsettled));
    try {
      const reviewer = loadTask(root, reviewerTaskId);
      const receipt = jsonFile(join(reviewer.dir, 'review-receipt.json'));
      const reviewerState = currentObservation(reviewer);
      check(
        reviewerState.errors.length === 0,
        `reviewer observation is no longer valid: ${reviewerState.errors.join(',')}`,
      );
      const reviewerObservation = reviewerState.observation;
      check(reviewer.record.independentReview?.subjectTaskId === record.taskId, 'foreign reviewer');
      check(receipt.reviewerTaskId === reviewerTaskId, 'review receipt task mismatch');
      check(receipt.subjectTaskId === record.taskId, 'foreign review receipt');
      check(
        receipt.subjectRequestDigest === record.requestDigest,
        'review request digest mismatch',
      );
      check(receipt.subjectBindingDigest === record.bindingDigest, 'review binding mismatch');
      check(
        receipt.subjectResponseDigest === observation.responseDigest,
        'review response mismatch',
      );
      check(
        isDeepStrictEqual(receipt.subjectFinalSnapshot, observation.finalSnapshot) &&
          isDeepStrictEqual(receipt.reviewerFinalSnapshot, observation.finalSnapshot),
        'review snapshot mismatch',
      );
      check(
        receipt.reviewerBindingDigest === reviewer.record.bindingDigest &&
          receipt.reviewerResponseDigest === reviewerObservation.responseDigest &&
          receipt.reviewerResolvedModel === reviewerObservation.resolvedModel,
        'reviewer observation mismatch',
      );
      check(
        receipt.reviewerId === reviewer.record.independentReview.reviewerId &&
          isDeepStrictEqual(receipt.builderIds, reviewer.record.independentReview.builderIds) &&
          isDeepStrictEqual(receipt.packet, reviewer.record.independentReview.packet),
        'reviewer scope mismatch',
      );
      check(
        reviewerObservation.response.content.length === 1 &&
          reviewerObservation.response.content[0]?.type === 'text' &&
          isDeepStrictEqual(
            JSON.parse(reviewerObservation.response.content[0].text),
            receipt.result,
          ),
        'review result is not the delivered reviewer response',
      );
      const derivedResult = structuredClone(receipt.result);
      derivedResult.identity.resolvedModel = reviewerObservation.resolvedModel;
      derivedResult.identity.observedModel = reviewerObservation.resolvedModel;
      linkedReview = {
        requestDigest: record.requestDigest,
        reviewerId: receipt.reviewerId,
        builderIds: receipt.builderIds,
        packet: receipt.packet,
        result: derivedResult,
      };
    } catch (error) {
      errors.push(error.message);
    }
  }
  // A writer's allowed changes are an output snapshot, not stale pre-dispatch input.
  // Common fan-in checks changedPaths against assignment; parent still reproduces findings.
  const common = validateClaudeWorkflowResults(
    { ...record.input, currentSnapshot: observation.finalSnapshot ?? record.input.currentSnapshot },
    { results, review: linkedReview },
  );
  errors.push(...common.errors);
  if (pendingReviewReceipt && errors.length === 0) {
    const receiptPath = join(dir, 'review-receipt.json');
    if (existsSync(receiptPath)) {
      if (!isDeepStrictEqual(jsonFile(receiptPath), pendingReviewReceipt))
        errors.push('review receipt changed');
    } else {
      writeFileSync(receiptPath, JSON.stringify(pendingReviewReceipt), {
        flag: 'wx',
        mode: 0o600,
      });
    }
  }
  // A valid completion is the Parent's acceptance; a bound retry of this task is then refused.
  if (errors.length === 0) {
    try {
      writeFileSync(
        join(dir, 'accepted.json'),
        JSON.stringify({ taskId: record.taskId, responseDigest: observation.responseDigest }),
        { flag: 'wx', mode: 0o600 },
      );
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    observation,
    observedEfforts: currentState.observedEfforts,
    common,
    verificationClass: 'local-evidence-and-static-contract',
    dispatchAuthorized: false,
    runtimeQualified: false,
  };
}

// Observation view for the task helper. Like complete, it first settles a recorded Stop (writing
// completion.json and releasing that task's writer lease), but it accepts no result and writes no receipt.
export function observeClaudeNativeTask(id, { root = process.cwd() } = {}) {
  root = realpathSync(root);
  const task = loadTask(root, id);
  const settlement = settleIfStopped(task);
  const state = currentObservation(task);
  return {
    record: task.record,
    observation: state.observation,
    changedPaths: state.actualPaths,
    observedEfforts: state.observedEfforts,
    errors: [...state.errors, ...settlement],
    evidenceDirectory: task.dir,
  };
}
// Writes a settled read-only subject's response once; a later call only confirms the file is unchanged.
export function writeClaudeNativeSubjectResponse(id, { root = process.cwd() } = {}) {
  root = realpathSync(root);
  const task = loadTask(root, id);
  const state = currentObservation(task);
  check(
    state.errors.length === 0,
    `completed subject observation required: ${state.errors.join(',')}`,
  );
  check(
    task.record.input.directAssignment.writeOwnership.length === 0,
    'writer subject response is not review input',
  );
  const path = subjectResponsePath(root, id);
  const text = subjectResponseText(state.observation);
  if (existsSync(join(root, path)))
    check(
      sameSubjectResponse(root, path, text),
      'subject response artifact does not match the settled response',
    );
  else writeFileSync(join(root, path), text, { flag: 'wx', mode: 0o600 });
  return path;
}
export function currentClaudeNativeSnapshot(root = process.cwd()) {
  return baseline(realpathSync(root));
}
export function claudeNativeSnapshotDigest(snapshot) {
  const { baseSHA, headSHA, dirtyDiffDigest, untrackedInputDigests } = snapshot;
  return hash({ baseSHA, headSHA, dirtyDiffDigest, untrackedInputDigests });
}

export function releaseClaudeNativeTask(id, { root = process.cwd(), ended = false } = {}) {
  check(ended === true, 'verify actual native task ended before release');
  root = realpathSync(root);
  const { dir } = loadTask(root, id);
  releaseWriter(root, id);
  markInvalid(dir, 'explicitly-released-after-end');
  return { taskId: id, released: true, completed: false };
}

const REVIEW_OPTIONS = {
  '--subject': 'subjectTaskId',
  '--parent-subject': 'parentSubject',
  '--runner-evidence': 'runnerEvidence',
  '--basis': 'selectionBasisRef',
  '--reviewer-model': 'reviewerModel',
  '--session': 'sessionId',
};
async function helperCommand(action, args) {
  // Loaded on demand: the helper consumes this module, and hooks never need it.
  const helper = await import('./native-task-helper.mjs');
  if (action === 'prepare') {
    check(args.length === 2 && args[0] === '--spec', 'expected prepare --spec FILE');
    return helper.prepareClaudeNativeTask(jsonFile(resolve(args[1])));
  }
  if (action === 'settle') {
    check(
      args[0] === '--task' &&
        (args.length === 2 || (args.length === 4 && args[2] === '--judgment')),
      'expected settle --task ID [--judgment FILE]',
    );
    return helper.settleClaudeNativeTask(
      args[1],
      args.length === 4 ? jsonFile(resolve(args[3])) : undefined,
    );
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = REVIEW_OPTIONS[args[i]];
    check(
      key && args[i + 1] && !Object.hasOwn(options, key),
      'expected review --subject ID | --parent-subject FILE [--runner-evidence FILE --basis REF --reviewer-model ID [--session ID]]',
    );
    options[key] = ['parentSubject', 'runnerEvidence'].includes(key)
      ? jsonFile(resolve(args[i + 1]))
      : args[i + 1];
  }
  return helper.buildClaudeNativeReview(options);
}
async function main(args) {
  if (['prepare', 'review', 'settle'].includes(args[0])) {
    const result = await helperCommand(args[0], args.slice(1));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    // A settle status with observation errors (effort included) is not an acceptable observation.
    if (result.valid === false || result.observationErrors?.length) process.exitCode = 1;
    return;
  }
  if (args[0] === '--hook' && args[1] === '--file-guard' && args.length === 2) {
    try {
      const raw = readFileSync(0);
      check(raw.length <= 1024 * 1024, 'hook payload limit');
      const result = guardClaudeNativeFileWrite(JSON.parse(raw), {
        root: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      });
      process.stdout.write(JSON.stringify(result));
    } catch (error) {
      process.stderr.write(`KNU file guard failed: ${error.message}\n`);
      // Exit 1 is a non-blocking error: a broken guard must never stop an ordinary edit.
      process.exitCode = 1;
    }
    return;
  }
  if (args[0] === '--hook' && args.length === 1) {
    let event;
    try {
      const raw = readFileSync(0);
      check(raw.length <= 1024 * 1024, 'hook payload limit');
      event = JSON.parse(raw);
      process.stdout.write(
        JSON.stringify(
          handleClaudeNativeSessionEvent(event, {
            root: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
          }),
        ),
      );
    } catch (error) {
      process.stderr.write(`KNU hook failed: ${error.message}\n`);
      // Exit 2 blocks a PreToolUse call but also keeps a subagent from stopping, so a failed stop or
      // session-start hook reports a non-blocking error. PostToolUse exit 2 only shows stderr.
      process.exitCode = ['SubagentStop', 'SessionStart'].includes(event?.hook_event_name) ? 1 : 2;
    }
    return;
  }
  const action = args.shift(),
    options = {};
  if (action === 'release') {
    check(
      args.length === 3 && args[0] === '--task' && args[2] === '--ended',
      'release --task ID --ended requires actual task termination first',
    );
    process.stdout.write(JSON.stringify(releaseClaudeNativeTask(args[1], { ended: true })) + '\n');
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    check(
      ['--input', '--task'].includes(args[i]) && args[i + 1] && !Object.hasOwn(options, args[i]),
      'expected register --input FILE | complete --task ID --input FILE',
    );
    options[args[i]] = args[i + 1];
  }
  check(options['--input'], 'input file required');
  const input = jsonFile(resolve(options['--input']));
  const result =
    action === 'register'
      ? registerClaudeNativeTask(input)
      : action === 'complete'
        ? completeClaudeNativeTask(options['--task'], input)
        : null;
  check(result, 'unknown operation');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.valid === false) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'))).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
}
