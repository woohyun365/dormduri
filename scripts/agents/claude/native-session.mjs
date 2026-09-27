// Ordinary interactive session adapter. No child process, permission allow, Home edits,
// or host authentication: files coordinate one task; Claude owns execution/permissions.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  existsSync,
  lstatSync,
  readlinkSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { prepareClaudeWorkflow, validateClaudeWorkflowResults } from './workflow-entry.mjs';
import {
  readClaudeStoppedTranscript,
  isClaudeCompletedNotification,
} from './native-session-evidence.mjs';
import { runClaudePreflight } from './session-preflight.mjs';

const ownDirectory = dirname(fileURLToPath(import.meta.url));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const marker = /\n\nKNU_NATIVE_TASK:([a-f0-9-]{36}):(sha256:[a-f0-9]{64})$/u;
const hash = (value) =>
  `sha256:${createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex')}`;
const inputHash = (value) =>
  hash(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
function check(value, reason) {
  if (!value) throw new TypeError(reason);
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

export function registerClaudeNativeTask({
  workflowInput,
  sessionId,
  prompt,
  expectedResolvedModel,
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
    ['knu_explorer', 'knu_researcher', 'knu_executor', 'knu_reviewer'].includes(role),
    'unknown repository role',
  );
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
    `workflow not ready: ${workflow.gaps.join(',')}`,
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
  const roleText = readFileSync(join(root, '.claude/agents', role + '.md'), 'utf8');
  const header = /^---\n([\s\S]*?)\n---/u.exec(roleText)?.[1];
  check(header && new RegExp(`^name: ${role}$`, 'mu').test(header), 'project role mismatch');
  const declared = /^tools: (.+)$/mu
    .exec(header)?.[1]
    ?.split(',')
    .map((s) => s.trim());
  check(isDeepStrictEqual(declared, binding.allowedTools), 'project role tools mismatch');
  check(
    binding.profileId === 'bounded-extraction' || input.reviewDisposition.required === true,
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
    bindingDigest: binding.bindingDigest,
    requestDigest: workflow.requestDigest,
    initialFiles: inventory(root, binding.readScope),
  };
  const digest = hash(record);
  const invocation = {
    description: 'Repository bounded task',
    subagent_type: role,
    model: binding.requestedModelAlias,
    prompt: `${prompt}\n\nKNU_NATIVE_TASK:${taskId}:${digest}`,
  };
  const dir = taskDirectory(root, taskId);
  ensureLocalDirectory(root, dir);
  writeFileSync(join(dir, 'task.json'), JSON.stringify({ record, invocation }), {
    flag: 'wx',
    mode: 0o600,
  });
  return { taskId, invocation, workflow, evidenceDirectory: dir, dispatchAuthorized: false };
}

function loadTask(root, id) {
  const dir = taskDirectory(root, id);
  check(realpathSync(dir) === dir, 'task path symlink');
  const { record, invocation } = jsonFile(join(dir, 'task.json'));
  check(record.version === 1 && record.taskId === id && record.root === root, 'foreign task');
  check(marker.exec(invocation.prompt)?.[2] === hash(record), 'task digest mismatch');
  return { dir, record, invocation };
}
function associated(event, task) {
  const { record, invocation } = task;
  check(
    event.session_id === record.sessionId && realpathSync(event.cwd) === record.root,
    'foreign session/root',
  );
  check(event.permission_mode === 'auto', 'expected auto permission mode');
  check(typeof event.tool_use_id === 'string' && event.tool_use_id.length > 0, 'missing tool id');
  check(isDeepStrictEqual(event.tool_input, invocation), 'native input/model mismatch');
  check(
    isDeepStrictEqual(
      localIdentity(record.root, invocation.subagent_type),
      record.input.adapterIdentity,
    ),
    'adapter/role/settings drift',
  );
}
function saveCompletion(task, attempt, r, completionSource) {
  const { dir, record, invocation } = task,
    root = record.root;
  const errors = responseErrors(record, r);
  if (r?.agentType !== undefined && r.agentType !== invocation.subagent_type)
    errors.push('role-mismatch');
  if (r?.prompt !== undefined && r.prompt !== invocation.prompt) errors.push('prompt-mismatch');
  const finalFiles = inventory(root, record.input.nativeRequest.task.readScope);
  const changedPaths = delta(record.initialFiles, finalFiles);
  if (changedPaths.some((p) => !covered(p, record.input.directAssignment.writeOwnership)))
    errors.push('outside-write-ownership');
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
    finalSnapshot: baseline(root),
    verificationClass: 'local-hook-observation-not-authentication',
  };
  writeFileSync(join(dir, 'completion.json'), JSON.stringify(observation), {
    flag: 'wx',
    mode: 0o600,
  });
  return observation;
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
  const parentPath = stop.transcript_path;
  check(
    typeof parentPath === 'string' &&
      parentPath.endsWith(`/${record.sessionId}.jsonl`) &&
      realpathSync(parentPath) === parentPath &&
      lstatSync(parentPath).size <= 8 * 1024 * 1024,
    'parent transcript unavailable/oversized',
  );
  const parentRows = readFileSync(parentPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
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
  const matches = [];
  for (const id of readdirSync(base).filter((id) => uuid.test(id))) {
    const task = loadTask(root, id);
    if (task.record.sessionId !== event.session_id || !existsSync(join(task.dir, 'launch.json')))
      continue;
    const launch = jsonFile(join(task.dir, 'launch.json'));
    if (launch.response.agentId === event.agent_id) matches.push(task);
  }
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
export function handleClaudeNativeSessionEvent(event, { root = process.cwd() } = {}) {
  root = realpathSync(root);
  if (event?.hook_event_name === 'SubagentStop') return stopped(event, root);
  if (event?.hook_event_name === 'PreToolUse' && event.tool_name === 'SendMessage') {
    const base = resolveArtifactPath(root, ['claude-native'], {});
    if (existsSync(base))
      for (const id of readdirSync(base).filter((id) => uuid.test(id))) {
        const task = loadTask(root, id);
        if (
          task.record.sessionId !== event.session_id ||
          !existsSync(join(task.dir, 'launch.json'))
        )
          continue;
        if (jsonFile(join(task.dir, 'launch.json')).response.agentId === event.tool_input?.to)
          return deny('bound child resume requires a new registered Agent task');
      }
    return {};
  }

  if (event?.hook_event_name === 'SessionStart') {
    check(uuid.test(event.session_id) && realpathSync(event.cwd) === root, 'invalid session');
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `KNU native session_id=${event.session_id}. Start with claude --permission-mode auto. For repository knu_* delegation read docs/development/agent-workflows/adapters/claude-code.md; register a bounded task with pnpm claude:native register --input <JSON file>, then call Agent with the exact returned invocation. Registration is not permission approval. Existing OMC roles keep their own policy; do not substitute them for a required KNU role. Missing/error hook is not fail-closed; verify completion receipts and semantic QA.`,
      },
    };
  }
  if (
    !['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].includes(event?.hook_event_name) ||
    event.tool_name !== 'Agent'
  )
    return {};
  const match =
    typeof event.tool_input?.prompt === 'string' && marker.exec(event.tool_input.prompt);
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
    associated(event, task);
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
          inputDigest: inputHash(event.tool_input),
        }),
        { flag: 'wx', mode: 0o600 },
      );
      return {}; // No allow: auto classifier/other permissions still decide.
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
        typeof r.agentId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/u.test(r.agentId),
        'missing async child identity',
      );
      check(
        r.resolvedModel === record.expectedResolvedModel && r.prompt === task.invocation.prompt,
        'async launch mismatch',
      );
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
    const observation = saveCompletion(task, attempt, r, event.hook_event_name);
    const errors = observation.errors;
    if (terminalObserved) releaseWriter(root, record.taskId);
    return {
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: `KNU task ${record.taskId}: ${observation.valid ? 'model observed; semantic acceptance and QA still required' : 'NOT COMPLETE: ' + errors.join(',')}. Evidence ${dir}/completion.json. Complete with pnpm claude:native complete --task ${record.taskId} --input <result JSON>.`,
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

export function completeClaudeNativeTask(
  id,
  { results = [], review, responseDigest, acceptance = [] } = {},
  { root = process.cwd() } = {},
) {
  root = realpathSync(root);
  const task = loadTask(root, id),
    { dir, record, invocation } = task;
  if (existsSync(join(dir, 'stop.json')) && !existsSync(join(dir, 'completion.json'))) {
    try {
      settleStoppedTask(task);
    } catch {
      /* Report missing completion, not a fabricated success. */
    }
  }
  let observation;
  try {
    observation = jsonFile(join(dir, 'completion.json'));
  } catch {
    observation = { valid: false, errors: ['no-completion-observation'] };
  }
  const errors = [...(observation.errors ?? [])];
  if (existsSync(join(dir, 'observation-error.json'))) errors.push('observation-error');
  if (observation.completionSource === 'SubagentStop+task-notification+transcript') {
    try {
      const proof = jsonFile(join(dir, 'transcript-proof.json'));
      check(
        proof.responseDigest === observation.responseDigest &&
          realpathSync(proof.path) === proof.path &&
          lstatSync(proof.path).size <= 4 * 1024 * 1024 &&
          hash(readFileSync(proof.path)) === proof.digest,
        'child resumed/transcript drift',
      );
    } catch {
      errors.push('child-transcript-drift-or-missing');
    }
  }
  let attempt;
  try {
    attempt = jsonFile(join(dir, 'attempt.json'));
  } catch {
    errors.push('missing-pretool');
  }
  if (
    observation.taskId !== id ||
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
  const finalFiles = inventory(root, record.input.nativeRequest.task.readScope);
  const actualPaths = delta(record.initialFiles, finalFiles);
  if (!isDeepStrictEqual(finalFiles, observation.finalFiles))
    errors.push('post-completion-file-drift');
  if (actualPaths.some((p) => !covered(p, record.input.directAssignment.writeOwnership)))
    errors.push('outside-write-ownership');
  const reported = [...new Set(results.flatMap((r) => r.changedPaths ?? []))].sort();
  if (!isDeepStrictEqual(actualPaths, reported)) errors.push('reported-change-path-mismatch');
  if (!observation.valid) errors.push('native-observation-required');
  if (
    !isDeepStrictEqual(localIdentity(root, invocation.subagent_type), record.input.adapterIdentity)
  )
    errors.push('adapter/role/settings drift');
  if (!isDeepStrictEqual(baseline(root), observation.finalSnapshot))
    errors.push('post-completion-source-drift');
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
  // A writer's allowed changes are an output snapshot, not stale pre-dispatch input.
  // Common fan-in checks changedPaths against assignment; parent still reproduces findings.
  const common = validateClaudeWorkflowResults(
    { ...record.input, currentSnapshot: observation.finalSnapshot ?? record.input.currentSnapshot },
    { results, review },
  );
  errors.push(...common.errors);
  return {
    valid: errors.length === 0,
    errors,
    observation,
    common,
    verificationClass: 'local-evidence-and-static-contract',
    dispatchAuthorized: false,
    runtimeQualified: false,
  };
}

export function releaseClaudeNativeTask(id, { root = process.cwd(), ended = false } = {}) {
  check(ended === true, 'verify actual native task ended before release');
  root = realpathSync(root);
  const { dir } = loadTask(root, id);
  releaseWriter(root, id);
  markInvalid(dir, 'explicitly-released-after-end');
  return { taskId: id, released: true, completed: false };
}

function main(args) {
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
      process.exitCode = 2;
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
  try {
    main(process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--')));
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
