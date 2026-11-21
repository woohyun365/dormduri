// Edit-time sensors (OSS-REVIEW P5): the binding `## 센서` rows that run at 편집 run in check mode right after an edit
// (직후) and before an agent's turn ends (끝). Host neutral: the Claude dispatcher loads it for its `--hook --sensor`
// entry and the Codex hook runs its CLI inside `codex sandbox`. Feedback never blocks; every result other than a pass
// is one activation record (edit-sensor-activation/v1) for evaluation. Rules and switches:
// docs/development/agent-workflows/review-criteria/README.md#센서-동작
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { workspaceRoot } from '../../artifacts/workspace-layout.mjs';
import {
  REVIEW_BINDING_PATH,
  REVIEW_CRITERIA_DIR,
  bindingPathGlobs,
  loadReviewCriteriaCatalog,
  matchPathGlob,
  matchReviewCriteriaPath,
} from './review-criteria-selection.mjs';

export const EDIT_SENSOR_SCHEMA = 'edit-sensor-activation/v1';
export const EDIT_SENSOR_SUMMARY_SCHEMA = 'edit-sensor-summary/v1';
const STATE_SCHEMA = 'edit-sensor-state/v1';
const BASELINE_SCHEMA = 'edit-sensor-baseline/v1';
export const EDIT_SENSOR_KIND = 'edit-sensors';
// Where the Codex hook (outside the sandbox) writes its own results; a workspace-write child cannot write there.
export const codexHookSensorDirectory = () =>
  `${workspaceRoot('codex-hook-state').path}/knu-edit-sensors`;
// The Parent baseline is one `git diff`; it never holds up the hook branch that calls it longer than this.
export const BASELINE_LIMIT_MS = 5000;
const SESSION_ID = /^[A-Za-z0-9-]{1,128}$/u;
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/u;
const OUTPUT_LINES = 12;
const OUTPUT_CHARS = 1200;
const REMINDERS_PER_POINT = 3;
const POINTS = ['직후', '끝'];

// Product workspaces: lint runs with the workspace's own config, the end check type-checks the product tsconfig. A
// prerequisite the repository builds in its own commands (shared build, prisma generate, Next typegen) is never built
// here; without it the check is skipped.
export const EDIT_SENSOR_WORKSPACES = [
  {
    dir: 'apps/web',
    tsconfig: 'tsconfig.product.json',
    prerequisites: ['packages/shared/dist', 'apps/web/.next/types'],
  },
  {
    dir: 'apps/api',
    tsconfig: 'tsconfig.json',
    prerequisites: ['packages/shared/dist', 'packages/database/dist'],
  },
  { dir: 'packages/shared', tsconfig: 'tsconfig.json', prerequisites: [] },
  {
    dir: 'packages/database',
    tsconfig: 'tsconfig.json',
    prerequisites: ['packages/database/src/generated/prisma'],
  },
];

const readOptional = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};
const digest = (path) => {
  try {
    return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
  } catch {
    return null;
  }
};
const checkSession = (sessionId) => {
  if (!SESSION_ID.test(sessionId ?? '')) throw new TypeError('sensor session id is invalid');
};
const sensorsOff = (env) => env?.KNU_EDIT_SENSORS === '0';
const remindersOn = (env) => env?.KNU_EDIT_REMINDERS === '1';
const cells = (row) =>
  row
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim());

function pathKeys(binding) {
  const keys = {};
  for (const line of binding.split('\n')) {
    const row = /^\|\s*`(repo-structure\.[a-z0-9-]+)`\s*\|\s*(.*?)\s*\|\s*$/u.exec(line);
    if (row) keys[row[1]] = bindingPathGlobs(row[2]);
  }
  return keys;
}
const globsOf = (spans, keys) => {
  const include = [];
  const exclude = [];
  for (const code of spans) {
    const found = /^repo-structure\.[a-z0-9-]+$/u.test(code)
      ? keys[code]
      : bindingPathGlobs(`\`${code}\``);
    include.push(...(found?.include ?? []));
    exclude.push(...(found?.exclude ?? []));
  }
  return { include, exclude };
};
const matches = (path, { include, exclude }) =>
  include.some((glob) => matchPathGlob(path, glob)) &&
  !exclude.some((glob) => matchPathGlob(path, glob));

// The `## 센서` rows whose 실행 시점 has 편집, with each point's limit (`직후 8초, 끝 30초`) and the target globs.
export function editSensorRows(root) {
  const binding = readOptional(join(root, REVIEW_BINDING_PATH));
  if (binding === null) return [];
  const section = binding.split(/^(?=## )/mu).find((block) => block.startsWith('## 센서\n'));
  if (!section) return [];
  const keys = pathKeys(binding);
  const rows = [];
  for (const line of section
    .split('\n')
    .filter((text) => text.startsWith('|'))
    .slice(2)) {
    const [key, target, , timing, limit] = cells(line);
    const id = /^`(sensor\.[a-z0-9-]+)`$/u.exec(key ?? '')?.[1];
    if (!id || !(timing ?? '').split(', ').includes('편집')) continue;
    const points = {};
    for (const part of (limit ?? '').split(', ')) {
      const point = /^(직후|끝) (\d+(?:\.\d+)?)초$/u.exec(part);
      if (point) points[point[1]] = Math.round(Number(point[2]) * 1000);
    }
    if (!Object.keys(points).length) continue;
    const spans = [...target.matchAll(/`([^`]+)`/gu)].map(([, code]) => code);
    rows.push({ id, points, targets: globsOf(spans, keys) });
  }
  return rows;
}

// Criteria items with their question, guidance and the binding keys of their selection lines.
function criteriaItems(root) {
  const dir = join(root, REVIEW_CRITERIA_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .flatMap((name) => {
      const text = readFileSync(join(dir, name), 'utf8');
      return text
        .split(/^(?=### [A-Z]+[0-9]+\. )/mu)
        .slice(1)
        .map((block) => {
          const line = (field) =>
            new RegExp(`^- ${field}: (.*)$`, 'mu').exec(block)?.[1]?.trim() ?? null;
          const refs = (field) =>
            [...(line(field) ?? '').matchAll(/\{\{binding:([a-z-]+\.[a-z0-9-]+)\}\}/gu)].map(
              ([, ref]) => ref,
            );
          const itemId = /^### ([A-Z]+[0-9]+)\. /u.exec(block)[1];
          return {
            id: `${name} ${itemId}`,
            document: name.slice(0, -3),
            path: `${REVIEW_CRITERIA_DIR}/${name}`,
            itemId,
            question: line('질문'),
            guidance: line('지침'),
            sensors: refs('센서'),
            triggers: refs('trigger'),
          };
        });
    });
}

// The documents automatic selection picks for one path; null when the catalog cannot load.
function documentsFor(context, path) {
  if (context.catalog === undefined) {
    try {
      context.catalog = loadReviewCriteriaCatalog(context.root);
    } catch {
      context.catalog = null;
    }
  }
  if (!context.catalog) return null;
  try {
    return matchReviewCriteriaPath(path, context.catalog).documents;
  } catch {
    return null;
  }
}
// The items that point at a sensor, narrowed to the documents that apply to the file when any do.
function itemsFor(context, sensor, path) {
  const pointing = context.items.filter((item) => item.sensors.includes(sensor));
  const documents = path ? documentsFor(context, path) : null;
  const applying = documents
    ? pointing.filter((item) => documents.includes(item.document))
    : pointing;
  return applying.length ? applying : pointing;
}

function toolBinary(root, workspace, tool) {
  for (const base of [workspace, '.'].filter(Boolean)) {
    const path = join(root, base, 'node_modules/.bin', tool);
    if (existsSync(path)) return path;
  }
  return null;
}
// One tool run within what is left of the point's limit. Exit codes are read by the caller.
function runTool(context, workspace, tool, args) {
  const binary = toolBinary(context.root, workspace, tool);
  if (!binary) return { result: 'skipped', detail: `${tool}-missing` };
  const left = context.deadline - Date.now();
  if (left <= 0) return { result: 'timeout', detail: tool };
  const run = spawnSync(binary, args, {
    cwd: join(context.root, workspace ?? '.'),
    env: { ...process.env, ...context.env },
    encoding: 'utf8',
    timeout: left,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (run.error?.code === 'ETIMEDOUT') return { result: 'timeout', detail: tool };
  if (run.error) return { result: 'error', detail: `${tool}: ${run.error.message}` };
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}
const workspaceOf = (path) =>
  EDIT_SENSOR_WORKSPACES.find(({ dir }) => path.startsWith(`${dir}/`)) ?? null;
const missingPrerequisite = (root, workspace) =>
  workspace.prerequisites.find((path) => !existsSync(join(root, path))) ?? null;

function git(context, args, timeout) {
  return spawnSync(
    'git',
    ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', context.root, ...args],
    {
      env: { ...process.env, ...context.env },
      encoding: 'utf8',
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}
const inHead = (context, path) =>
  git(context, ['cat-file', '-e', `HEAD:${path}`], Math.max(context.deadline - Date.now(), 1))
    .status === 0;

function formatCheck(context, row) {
  return context.files
    .filter((path) => matches(path, row.targets) && existsSync(join(context.root, path)))
    .map((path) => {
      const run = runTool(context, null, 'prettier', ['--check', '--ignore-unknown', path]);
      if (run.result) return { ...run, file: path };
      if (run.status === 0) return { result: 'pass', file: path };
      return run.status === 1
        ? { result: 'fail', file: path, output: run.output }
        : { result: 'error', file: path, detail: `prettier exit ${run.status}` };
    });
}
function lintCheck(context, row) {
  return context.files
    .filter(
      (path) =>
        SCRIPT_FILE.test(path) &&
        matches(path, row.targets) &&
        workspaceOf(path) &&
        existsSync(join(context.root, path)),
    )
    .map((path) => {
      const workspace = workspaceOf(path);
      const missing = missingPrerequisite(context.root, workspace);
      if (missing) return { result: 'skipped', file: path, detail: `prerequisite ${missing}` };
      const run = runTool(context, workspace.dir, 'eslint', [
        '--no-warn-ignored',
        relative(workspace.dir, path),
      ]);
      if (run.result) return { ...run, file: path };
      if (run.status === 0) return { result: 'pass', file: path };
      return run.status === 1
        ? { result: 'fail', file: path, output: run.output }
        : { result: 'error', file: path, detail: `eslint exit ${run.status}` };
    });
}
function typecheck(context, row) {
  const workspaces = [
    ...new Set(
      context.files
        .filter((path) => SCRIPT_FILE.test(path) && matches(path, row.targets))
        .map((path) => workspaceOf(path)?.dir)
        .filter(Boolean),
    ),
  ];
  return workspaces.map((dir) => {
    const workspace = EDIT_SENSOR_WORKSPACES.find((candidate) => candidate.dir === dir);
    const file = context.files.find((path) => path.startsWith(`${dir}/`));
    const missing = missingPrerequisite(context.root, workspace);
    if (missing)
      return { result: 'skipped', file, workspace: dir, detail: `prerequisite ${missing}` };
    const run = runTool(context, dir, 'tsc', ['-p', workspace.tsconfig, '--noEmit']);
    if (run.result) return { ...run, file, workspace: dir };
    if (run.status === 0) return { result: 'pass', file, workspace: dir };
    return /error TS\d+/u.test(run.output)
      ? { result: 'fail', file, workspace: dir, output: run.output }
      : { result: 'error', file, workspace: dir, detail: `tsc exit ${run.status}` };
  });
}
// An existing test (in HEAD) changed right after an edit, or deleted by a Codex patch, is marked once a session.
function testChanged(context, row) {
  const mark = (path, change) => {
    if (context.marked.has(path) || !matches(path, row.targets) || !inHead(context, path))
      return [];
    context.marked.add(path);
    context.state.push({ type: 'mark', file: path });
    return [{ result: 'warning', file: path, change }];
  };
  return [
    ...context.files.flatMap((path) => mark(path, 'changed')),
    ...context.deleted.flatMap((path) => mark(path, 'deleted')),
  ];
}
// Before the end: tests deleted since the Parent baseline (`git diff` has no agent), marked once a session. Without a
// baseline (timed out, or a session that started before the hook) the check is skipped, recorded once a session.
function testsDeleted(context, row) {
  const baseline = readBaseline(context.root, context.sessionId);
  if (!baseline || baseline.timedOut) {
    if (context.previous.some(({ type }) => type === 'no-baseline')) return [];
    context.state.push({ type: 'no-baseline' });
    return [{ result: 'skipped', file: null, detail: 'no baseline' }];
  }
  const left = context.deadline - Date.now();
  if (left <= 0) return [{ result: 'timeout', file: null, detail: 'git' }];
  const diff = git(context, ['diff', '--name-status', '--no-renames', '-z', 'HEAD'], left);
  if (diff.error?.code === 'ETIMEDOUT') return [{ result: 'timeout', file: null, detail: 'git' }];
  if (diff.error || diff.status !== 0)
    return [{ result: 'error', file: null, detail: `git diff exit ${diff.status}` }];
  const fields = diff.stdout.split('\0').filter(Boolean);
  const deleted = [];
  for (let index = 0; index + 1 < fields.length; index += 2)
    if (fields[index] === 'D') deleted.push(fields[index + 1]);
  const before = new Set(baseline.deleted);
  return deleted
    .filter((path) => matches(path, row.targets) && !before.has(path) && !context.marked.has(path))
    .map((path) => {
      context.marked.add(path);
      context.state.push({ type: 'mark', file: path });
      return { result: 'warning', file: path, change: 'deleted' };
    });
}

export const EDIT_SENSOR_RUNNERS = {
  'sensor.format': { 직후: formatCheck },
  'sensor.lint': { 직후: lintCheck },
  'sensor.typecheck': { 끝: typecheck },
  'sensor.test-change': { 직후: testChanged, 끝: testsDeleted },
};

const sensorDirectory = (root) => resolveArtifactPath(root, [EDIT_SENSOR_KIND]);
export const editSensorRecordFile = (root, sessionId) =>
  join(sensorDirectory(root), `${sessionId}.jsonl`);
const stateFile = (root, sessionId) => join(sensorDirectory(root), `${sessionId}.state.jsonl`);
const baselineFile = (root, sessionId) => join(sensorDirectory(root), `${sessionId}.baseline.json`);

export function appendEditSensorActivation(root, sessionId, record) {
  checkSession(sessionId);
  const file = editSensorRecordFile(root, sessionId);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`);
}
const jsonLines = (text) =>
  (text ?? '')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
function readState(root, sessionId) {
  return jsonLines(readOptional(stateFile(root, sessionId))).filter(
    (line) => line?.schema === STATE_SCHEMA,
  );
}
function appendState(root, sessionId, lines) {
  if (!lines.length) return;
  const file = stateFile(root, sessionId);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(
    file,
    lines.map((line) => `${JSON.stringify({ schema: STATE_SCHEMA, ...line })}\n`).join(''),
  );
}
function readBaseline(root, sessionId) {
  try {
    const baseline = JSON.parse(readFileSync(baselineFile(root, sessionId), 'utf8'));
    return baseline?.schema === BASELINE_SCHEMA ? baseline : null;
  } catch {
    return null;
  }
}

function activation(context, point, sensor, outcome, extra = {}) {
  return {
    schema: EDIT_SENSOR_SCHEMA,
    at: context.now(),
    host: context.host,
    sessionId: context.sessionId,
    agent: context.agent,
    point,
    sensor,
    criteria: outcome.criteria ?? [],
    file: outcome.file ?? null,
    sha256: outcome.file ? digest(join(context.root, outcome.file)) : null,
    result: outcome.result,
    ...(outcome.detail ? { detail: outcome.detail } : {}),
    ...extra,
  };
}
const summary = (output) => {
  const lines = output.trim().split('\n').slice(0, OUTPUT_LINES).join('\n');
  return lines.length > OUTPUT_CHARS ? `${lines.slice(0, OUTPUT_CHARS)}…` : lines;
};
const FALLBACK_FIX = {
  'sensor.format':
    'format the file with the repository formatter settings (Prettier --write on that file)',
  'sensor.lint': 'fix the reported rule in the file',
  'sensor.typecheck': 'fix the reported type errors',
  'sensor.test-change': 'state why the protected behavior changed and keep its RED evidence',
};
function feedback(sensor, outcome) {
  const what =
    outcome.result === 'warning'
      ? `KNU edit sensor ${sensor}: ${outcome.file} is an existing test and was ${outcome.change} (this does not block)`
      : `KNU edit sensor ${sensor} failed: ${outcome.workspace ?? outcome.file}`;
  const fixes = outcome.items.length
    ? outcome.items
        .slice(0, 2)
        .flatMap((item) => [
          `How to fix: ${item.guidance ?? FALLBACK_FIX[sensor]}`,
          `Reference: ${item.path} ${item.itemId}`,
        ])
    : [
        `How to fix: ${FALLBACK_FIX[sensor] ?? 'fix the reported problem'}`,
        `Reference: ${REVIEW_BINDING_PATH} ## 센서 ${sensor}`,
      ];
  return [what, ...(outcome.output ? [summary(outcome.output)] : []), ...fixes].join('\n');
}
const HEADER = 'KNU edit sensors (feedback only; KNU_EDIT_SENSORS=0 turns them off):';

function contextFor({ root, sessionId, host, agent, files = [], deleted = [], env = {}, now }) {
  checkSession(sessionId);
  root = realpathSync(root);
  const state = readState(root, sessionId);
  return {
    root,
    sessionId,
    host,
    agent: agent ?? 'parent',
    files: [...new Set(files)],
    deleted: [...new Set(deleted)],
    env,
    now: now ?? (() => new Date().toISOString()),
    items: criteriaItems(root),
    previous: state,
    marked: new Set(state.filter(({ type }) => type === 'mark').map(({ file }) => file)),
    reminded: new Set(state.filter(({ type }) => type === 'remind').map(({ item }) => item)),
    state: [],
  };
}
function runPoint(context, point, deadlineMs) {
  const rows = editSensorRows(context.root).filter(
    (row) => row.points[point] !== undefined && EDIT_SENSOR_RUNNERS[row.id]?.[point],
  );
  const limit = Math.min(
    Math.max(0, ...rows.map((row) => row.points[point])),
    deadlineMs ?? Infinity,
  );
  context.deadline = Date.now() + limit;
  return rows.flatMap((row) =>
    EDIT_SENSOR_RUNNERS[row.id]
      [point](context, row)
      .filter(({ result }) => result !== 'pass')
      .map((outcome) => {
        const items = itemsFor(context, row.id, outcome.file);
        return { ...outcome, sensor: row.id, items, criteria: items.map(({ id }) => id) };
      }),
  );
}
// Up to three questions a point, chosen by the file's trigger lines or else its documents' path keys; once a session.
function reminders(context) {
  const keys = pathKeys(readOptional(join(context.root, REVIEW_BINDING_PATH)) ?? '');
  const chosen = [];
  for (const path of context.files) {
    const documents = documentsFor(context, path) ?? [];
    for (const item of context.items) {
      if (chosen.length >= REMINDERS_PER_POINT) break;
      if (!documents.includes(item.document) || context.reminded.has(item.id) || !item.question)
        continue;
      if (
        item.triggers.length &&
        !item.triggers.some((key) => keys[key] && matches(path, keys[key]))
      )
        continue;
      if (chosen.some((entry) => entry.item.id === item.id)) continue;
      chosen.push({ item, file: path });
    }
  }
  for (const { item } of chosen) {
    context.reminded.add(item.id);
    context.state.push({ type: 'remind', item: item.id });
  }
  return chosen;
}

// Right after an edit: format and lint of each changed file, existing test changes, and reminders when switched on.
export function afterEdit(input) {
  if (sensorsOff(input.env)) return { message: null, records: [] };
  const context = contextFor(input);
  context.state.push(
    ...context.files.map((file) => ({ type: 'edit', agent: context.agent, file })),
  );
  const outcomes = runPoint(context, '직후', input.deadlineMs);
  const records = outcomes.map((outcome) => activation(context, '직후', outcome.sensor, outcome));
  const reminded = remindersOn(input.env) ? reminders(context) : [];
  records.push(
    ...reminded.map(({ item, file }) =>
      activation(context, '직후', 'reminder', { result: 'reminder', file, criteria: [item.id] }),
    ),
  );
  for (const record of records) appendEditSensorActivation(context.root, context.sessionId, record);
  appendState(context.root, context.sessionId, context.state);
  const parts = [
    ...outcomes
      .filter(({ result }) => ['fail', 'warning'].includes(result))
      .map((outcome) => feedback(outcome.sensor, outcome)),
    ...reminded.map(({ item }) => `KNU reminder (${item.id}): ${item.question}`),
  ];
  return { message: parts.length ? [HEADER, ...parts].join('\n\n') : null, records };
}

// Before an agent's turn ends: typecheck of the workspaces it edited since its last end and tests deleted since the
// Parent baseline. A fail right after an edit whose file is unchanged now is recorded again (a false positive
// candidate). The caller decides whether the message goes back to the agent.
export function beforeEnd(input) {
  if (sensorsOff(input.env)) return { message: null, records: [] };
  const context = contextFor(input);
  const lastEnd = context.previous.findLastIndex(
    ({ type, agent }) => type === 'end' && agent === context.agent,
  );
  context.files = [
    ...new Set(
      context.previous
        .slice(lastEnd + 1)
        .filter(({ type, agent }) => type === 'edit' && agent === context.agent)
        .map(({ file }) => file),
    ),
  ];
  const endedAt = lastEnd >= 0 ? context.previous[lastEnd].at : null;
  const outcomes = runPoint(context, '끝', input.deadlineMs);
  const records = outcomes.map((outcome) => activation(context, '끝', outcome.sensor, outcome));
  const latest = new Map();
  for (const record of jsonLines(
    readOptional(editSensorRecordFile(context.root, context.sessionId)),
  ))
    if (
      record?.schema === EDIT_SENSOR_SCHEMA &&
      record.agent === context.agent &&
      record.point === '직후' &&
      record.result === 'fail' &&
      record.file &&
      (endedAt === null || record.at > endedAt)
    )
      latest.set(`${record.sensor}\0${record.file}`, record);
  for (const record of latest.values())
    if (record.sha256 && digest(join(context.root, record.file)) === record.sha256)
      records.push(
        activation(
          context,
          '끝',
          record.sensor,
          { result: 'fail', file: record.file, criteria: record.criteria },
          { unchangedSince: record.at },
        ),
      );
  for (const record of records) appendEditSensorActivation(context.root, context.sessionId, record);
  context.state.push({ type: 'end', agent: context.agent, at: context.now() });
  appendState(context.root, context.sessionId, context.state);
  const parts = outcomes
    .filter(({ result }) => ['fail', 'warning'].includes(result))
    .map((outcome) => feedback(outcome.sensor, outcome));
  return { message: parts.length ? [HEADER, ...parts].join('\n\n') : null, records };
}

// The Parent's deleted files when its session starts (Claude SessionStart, Codex first event). An existing baseline
// stays (SessionStart also comes on resume and compact); a run over the limit leaves a timed-out baseline, so the
// session's deletion check is skipped rather than measured from a later point.
export function recordParentBaseline({
  root,
  sessionId,
  host,
  env = {},
  now,
  limitMs = BASELINE_LIMIT_MS,
}) {
  if (sensorsOff(env)) return { result: 'off' };
  checkSession(sessionId);
  root = realpathSync(root);
  if (!editSensorRows(root).some((row) => row.points['끝'] && row.id === 'sensor.test-change'))
    return { result: 'off' };
  const file = baselineFile(root, sessionId);
  if (existsSync(file)) return { result: 'exists' };
  const context = {
    root,
    sessionId,
    host,
    agent: 'parent',
    env,
    now: now ?? (() => new Date().toISOString()),
  };
  const at = context.now();
  const write = (body) => {
    mkdirSync(dirname(file), { recursive: true });
    try {
      writeFileSync(file, `${JSON.stringify({ schema: BASELINE_SCHEMA, at, ...body })}\n`, {
        flag: 'wx',
      });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  };
  const diff = git(
    context,
    ['diff', '--name-status', '--no-renames', '-z', 'HEAD'],
    Math.max(1, Math.min(limitMs, BASELINE_LIMIT_MS)),
  );
  if (diff.error?.code === 'ETIMEDOUT') {
    write({ timedOut: true });
    appendEditSensorActivation(
      root,
      sessionId,
      activation(context, '끝', 'sensor.test-change', { result: 'timeout', detail: 'baseline' }),
    );
    return { result: 'timeout' };
  }
  if (diff.error || diff.status !== 0) {
    appendEditSensorActivation(
      root,
      sessionId,
      activation(context, '끝', 'sensor.test-change', {
        result: 'error',
        detail: `baseline git diff exit ${diff.status}`,
      }),
    );
    return { result: 'error' };
  }
  const fields = diff.stdout.split('\0').filter(Boolean);
  const deleted = [];
  for (let index = 0; index + 1 < fields.length; index += 2)
    if (fields[index] === 'D') deleted.push(fields[index + 1]);
  write({ deleted });
  return { result: 'recorded' };
}

// A path the hook names, as a repository-relative path; null outside the repository.
function repositoryFile(root, cwd, target) {
  if (typeof target !== 'string' || !target) return null;
  let existing = resolve(typeof cwd === 'string' && isAbsolute(cwd) ? cwd : root, target);
  const rest = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return null;
    rest.unshift(basename(existing));
    existing = parent;
  }
  const path = relative(root, join(realpathSync(existing), ...rest));
  return !path || path.startsWith('..') || isAbsolute(path) ? null : path.split('\\').join('/');
}

// Claude `native-session.mjs --hook --sensor`: PostToolUse Edit|Write and Stop. Throws for the dispatcher to record.
export function claudeSensorHook(event, { root = process.cwd(), env = process.env } = {}) {
  root = realpathSync(root);
  checkSession(event?.session_id);
  const sessionId = event.session_id;
  if (event.hook_event_name === 'PostToolUse' && ['Edit', 'Write'].includes(event.tool_name)) {
    const file = repositoryFile(root, event.cwd, event.tool_input?.file_path);
    if (!file) return null;
    const agent = typeof event.agent_id === 'string' ? event.agent_id : 'parent';
    const { message } = afterEdit({ root, sessionId, host: 'claude', agent, files: [file], env });
    return message
      ? { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message } }
      : null;
  }
  if (event.hook_event_name === 'Stop') {
    // A turn the stop hook already continued is recorded only (Owner 1.1).
    const active = event.stop_hook_active === true;
    const { message } = beforeEnd({
      root,
      sessionId,
      host: 'claude',
      agent: 'parent',
      stopHookActive: active,
      env,
    });
    return message && !active
      ? { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: message } }
      : null;
  }
  return null;
}

// The dispatcher's last resort for an error inside the sensors: one error record. Throws when it cannot record.
export function recordSensorFailure({ root, sessionId, host, point, error }) {
  root = realpathSync(root);
  const context = { root, sessionId, host, agent: 'parent', now: () => new Date().toISOString() };
  appendEditSensorActivation(
    root,
    sessionId,
    activation(context, point, null, {
      result: 'error',
      detail: String(error?.message ?? error).slice(0, 200),
    }),
  );
}

// Activation counts by sensor and by criteria item, and the false positive candidates, across both record places.
export function summarizeEditSensors(root) {
  root = realpathSync(root);
  const directories = [sensorDirectory(root), join(root, codexHookSensorDirectory())];
  const records = directories.flatMap((dir) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => name.endsWith('.jsonl'))
          .sort()
          .flatMap((name) => jsonLines(readOptional(join(dir, name))))
          .filter((record) => record?.schema === EDIT_SENSOR_SCHEMA)
      : [],
  );
  const bySensor = {};
  const byCriteria = {};
  // An unchanged end record repeats an activation already counted: it counts only as a false positive candidate.
  for (const record of records.filter(({ unchangedSince }) => !unchangedSince)) {
    const sensor = record.sensor ?? '(hook)';
    bySensor[sensor] ??= {};
    bySensor[sensor][record.result] = (bySensor[sensor][record.result] ?? 0) + 1;
    for (const id of record.criteria ?? []) byCriteria[id] = (byCriteria[id] ?? 0) + 1;
  }
  return {
    schema: EDIT_SENSOR_SUMMARY_SCHEMA,
    sessions: new Set(records.map(({ sessionId }) => sessionId)).size,
    records: records.length,
    bySensor,
    byCriteria,
    falsePositiveCandidates: records.filter(({ unchangedSince }) => unchangedSince).length,
  };
}

const CODEX_USAGE =
  'usage: edit-sensors.mjs --summary [--root DIR] | edit-sensors.mjs codex --root DIR --event PostToolUse|Stop --session ID --agent ID --files JSON --deleted JSON --reminders 0|1 --stop-hook-active 0|1 --deadline-ms N';
const CODEX_FLAGS = [
  '--root',
  '--event',
  '--session',
  '--agent',
  '--files',
  '--deleted',
  '--reminders',
  '--stop-hook-active',
  '--deadline-ms',
];
function parseFlags(args, allowed) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !allowed.includes(args[index]) ||
      args[index + 1] === undefined ||
      Object.hasOwn(options, args[index])
    )
      return null;
    options[args[index]] = args[index + 1];
  }
  return options;
}
const jsonList = (text) => {
  const value = JSON.parse(text);
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
    throw new TypeError('expected a JSON list of paths');
  return value;
};
// The Codex hook runs this inside `codex sandbox`: the Parent baseline on the first event, then one event. Feedback is
// printed as JSON; an error inside is one error record and an empty answer.
function codexEvent(options) {
  const started = Date.now();
  const deadlineMs = Number(options['--deadline-ms']);
  const root = realpathSync(options['--root']);
  const sessionId = options['--session'];
  const env = { KNU_EDIT_REMINDERS: options['--reminders'] === '1' ? '1' : '0' };
  const point = options['--event'] === 'Stop' ? '끝' : '직후';
  try {
    recordParentBaseline({
      root,
      sessionId,
      host: 'codex',
      env,
      limitMs: Math.min(BASELINE_LIMIT_MS, deadlineMs),
    });
    const left = Math.max(0, deadlineMs - (Date.now() - started));
    const input = {
      root,
      sessionId,
      host: 'codex',
      agent: options['--agent'],
      env,
      deadlineMs: left,
    };
    if (point === '직후') {
      const { message } = afterEdit({
        ...input,
        files: jsonList(options['--files']),
        deleted: jsonList(options['--deleted']),
      });
      return message ? { additionalContext: message } : {};
    }
    const { message } = beforeEnd({
      ...input,
      stopHookActive: options['--stop-hook-active'] === '1',
    });
    return message ? { systemMessage: message } : {};
  } catch (error) {
    try {
      recordSensorFailure({ root, sessionId, host: 'codex', point, error });
    } catch {
      process.stderr.write(`KNU edit sensor failed: ${error.message}\n`);
    }
    return {};
  }
}

function main(args) {
  if (args[0] === '--summary') {
    const options = parseFlags(args.slice(1), ['--root']);
    if (!options) {
      process.stderr.write(`${CODEX_USAGE}\n`);
      process.exitCode = 2;
      return;
    }
    process.stdout.write(
      `${JSON.stringify(summarizeEditSensors(options['--root'] ?? process.cwd()), null, 2)}\n`,
    );
    return;
  }
  const options = args[0] === 'codex' ? parseFlags(args.slice(1), CODEX_FLAGS) : null;
  if (
    !options ||
    CODEX_FLAGS.some((flag) => options[flag] === undefined) ||
    !['PostToolUse', 'Stop'].includes(options['--event']) ||
    !Number.isFinite(Number(options['--deadline-ms']))
  ) {
    process.stderr.write(`${CODEX_USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(JSON.stringify(codexEvent(options)));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
