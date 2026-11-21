import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  CRITERIA_DIR,
  CRITERIA_ITEMS,
  LINT_ERROR,
  SESSION,
  SLOW,
  TYPE_ERROR,
  UNFORMATTED,
  sensorRepo,
  sensorTable,
  stubCommand,
} from './fixtures/edit-sensors-repo.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const MODULE = resolve(repoRoot, 'scripts/agents/common/edit-sensors.mjs');
// Loaded per test so the missing module fails each case on this reason instead of an import error.
async function sensors() {
  try {
    return await import('../../../agents/common/edit-sensors.mjs');
  } catch {
    assert.fail('edit-sensors module is not implemented');
  }
}
async function repo(t, options = {}) {
  const module = await sensors();
  return { module, ...sensorRepo(t, { workspaces: module.EDIT_SENSOR_WORKSPACES, ...options }) };
}
const base = (r, extra = {}) => ({
  root: r.root,
  sessionId: SESSION,
  host: 'claude',
  env: {},
  ...extra,
});
const results = (records) => records.map(({ sensor, result }) => `${sensor}:${result}`);

test('the binding 편집 rows give each sensor its points, limits and targets', async (t) => {
  const r = await repo(t);
  const rows = r.module.editSensorRows(r.root);
  assert.deepEqual(
    rows.map(({ id, points }) => [id, points]),
    [
      ['sensor.format', { 직후: 8000 }],
      ['sensor.lint', { 직후: 8000 }],
      ['sensor.typecheck', { 끝: 30000 }],
      ['sensor.test-change', { 직후: 8000, 끝: 30000 }],
    ],
    'a row without 편집 is not an edit sensor',
  );
  assert.deepEqual(rows.find(({ id }) => id === 'sensor.lint').targets.include, [
    'apps/**',
    'packages/**',
  ]);
});

test('every 편집 row of the repository binding has a runner and the format, lint and typecheck rows run at 편집', async () => {
  const module = await sensors();
  const rows = module.editSensorRows(repoRoot);
  assert.deepEqual(rows.map(({ id }) => id).sort(), [
    'sensor.format',
    'sensor.lint',
    'sensor.test-change',
    'sensor.typecheck',
  ]);
  for (const { id } of rows) assert.ok(module.EDIT_SENSOR_RUNNERS[id], `${id} has no runner`);
  // The repository limits are the Owner's: 8 seconds right after an edit, 30 before the turn ends.
  assert.deepEqual(Object.fromEntries(rows.map(({ id, points }) => [id, points])), {
    'sensor.format': { 직후: 8000 },
    'sensor.lint': { 직후: 8000 },
    'sensor.typecheck': { 끝: 30000 },
    'sensor.test-change': { 직후: 8000, 끝: 30000 },
  });
  // S6 points at the test change row (Owner 3.1); the row reaches no other item.
  const swe = readFileSync(join(repoRoot, CRITERIA_DIR, 'swe.md'), 'utf8');
  const s6 = swe.slice(swe.indexOf('### S6. '), swe.indexOf('### S7. '));
  assert.match(s6, /^- 센서: \{\{binding:sensor\.test-change\}\}$/mu);
});

// RED 1: a format failure comes back next to the tool result with the sensor, how to fix and where to read.
test('a file that fails the format check gets feedback and one fail record; a passing file gets neither', async (t) => {
  const r = await repo(t);
  r.write(r.files.doc, `# notes ${UNFORMATTED}\n`);
  const event = {
    session_id: SESSION,
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: join(r.root, r.files.doc) },
    cwd: r.root,
  };
  const output = r.module.claudeSensorHook(event, { root: r.root, env: {} });
  assert.equal(output?.hookSpecificOutput?.hookEventName, 'PostToolUse');
  const context = output.hookSpecificOutput.additionalContext;
  assert.match(context, /sensor\.format/u);
  assert.match(context, /notes\.md/u);
  assert.match(context, /Code style issues/u, 'the tool output summary is in the feedback');
  assert.match(context, /How to fix: /u);
  assert.match(context, /Reference: /u);
  const [record, ...rest] = r.records();
  assert.deepEqual(rest, []);
  assert.equal(record.schema, 'edit-sensor-activation/v1');
  assert.deepEqual(
    [record.host, record.agent, record.point, record.sensor, record.file, record.result],
    ['claude', 'parent', '직후', 'sensor.format', r.files.doc, 'fail'],
  );
  assert.match(record.sha256, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(record.sessionId, SESSION);
  assert.ok(Array.isArray(record.criteria));

  r.write(r.files.doc, '# notes fixed\n');
  assert.equal(r.module.claudeSensorHook(event, { root: r.root, env: {} }), null);
  assert.equal(r.records().length, 1, 'a passing check leaves no record');
});

test('a lint failure names the guidance and the criteria item that point at the lint row', async (t) => {
  const r = await repo(t);
  r.write(r.files.source, `export const unused = 1; // ${LINT_ERROR}\n`);
  const { message, records } = r.module.afterEdit(
    base(r, { agent: 'parent', files: [r.files.source] }),
  );
  assert.match(message, /sensor\.lint/u);
  assert.match(message, /no-unused-vars/u);
  assert.ok(message.includes(CRITERIA_ITEMS.lint.guidance), message);
  assert.ok(message.includes(`${CRITERIA_DIR}/swe.md ${CRITERIA_ITEMS.lint.id}`), message);
  assert.deepEqual(results(records), ['sensor.lint:fail']);
  assert.deepEqual(records[0].criteria, [`swe.md ${CRITERIA_ITEMS.lint.id}`]);
  // The lint stub ran inside the file's workspace with the workspace-relative path.
  assert.ok(
    r.stubCalls().some((call) => /^eslint (?:-\S+ )*src\/sample\.ts$/u.test(call)),
    r.stubCalls().join('\n'),
  );
});

// RED 2: over the limit is a timeout record and silence; a missing prerequisite is a skipped record.
test('a check over its limit records timeout and gives no feedback; a missing prerequisite records skipped', async (t) => {
  const r = await repo(t, { table: sensorTable({ after: '직후 1초', end: '끝 1초' }) });
  r.write(r.files.source, `export const value = 1; // ${SLOW}\n`);
  const started = Date.now();
  const { message, records } = r.module.afterEdit(
    base(r, { agent: 'parent', files: [r.files.source] }),
  );
  assert.ok(Date.now() - started < 2500, 'the point stops at its limit');
  assert.equal(message, null);
  assert.ok(results(records).includes('sensor.format:timeout'), results(records).join());

  const bare = await repo(t, { prerequisites: false });
  bare.write(bare.files.source, `export const unused = 1; // ${LINT_ERROR}\n`);
  const after = bare.module.afterEdit(base(bare, { agent: 'parent', files: [bare.files.source] }));
  assert.equal(after.message, null);
  assert.deepEqual(results(after.records), ['sensor.lint:skipped']);
  const end = bare.module.beforeEnd(base(bare, { agent: 'parent', stopHookActive: false }));
  assert.ok(results(end.records).includes('sensor.typecheck:skipped'), results(end.records).join());
  assert.ok(
    !bare.stubCalls().some((call) => call.startsWith('tsc ')),
    'no typecheck without its prerequisites',
  );
});

// RED 3: the end check gives feedback once; stop_hook_active records only; a child's edits are not the Parent's.
test('the Stop check returns its failure once and records only when the stop hook already continued', async (t) => {
  const r = await repo(t);
  const edit = (file, agent) =>
    r.module.claudeSensorHook(
      {
        session_id: SESSION,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: join(r.root, file) },
        ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
        cwd: r.root,
      },
      { root: r.root, env: {} },
    );
  const stop = (active) =>
    r.module.claudeSensorHook(
      { session_id: SESSION, hook_event_name: 'Stop', stop_hook_active: active, cwd: r.root },
      { root: r.root, env: {} },
    );
  assert.equal(r.module.recordParentBaseline(base(r)).result, 'recorded');
  r.write(r.files.source, `export const value: number = 'x'; // ${TYPE_ERROR}\n`);
  assert.equal(edit(r.files.source), null);
  const first = stop(false);
  assert.equal(first?.hookSpecificOutput?.hookEventName, 'Stop');
  assert.match(first.hookSpecificOutput.additionalContext, /sensor\.typecheck/u);
  assert.match(first.hookSpecificOutput.additionalContext, /TS2322/u);
  assert.ok(first.hookSpecificOutput.additionalContext.includes(CRITERIA_ITEMS.typecheck.guidance));
  assert.deepEqual(results(r.records().filter(({ point }) => point === '끝')), [
    'sensor.typecheck:fail',
  ]);
  // The continued turn edits again and stops with stop_hook_active: the check runs and is recorded, nothing returns.
  assert.equal(edit(r.files.source), null);
  assert.equal(stop(true), null);
  assert.equal(
    r.records().filter(({ point, sensor }) => point === '끝' && sensor === 'sensor.typecheck')
      .length,
    2,
  );
  // A turn with only a child's edits: the Parent Stop does not typecheck them.
  const calls = r.stubCalls().filter((call) => call.startsWith('tsc ')).length;
  assert.equal(edit(r.files.source, 'agent-1'), null);
  assert.equal(stop(false), null);
  assert.equal(r.stubCalls().filter((call) => call.startsWith('tsc ')).length, calls);
});

// RED 5: KNU_EDIT_SENSORS=0 is silence; reminders are off by default and bounded when on.
test('the sensor switch turns everything off and reminders are off until KNU_EDIT_REMINDERS=1', async (t) => {
  const r = await repo(t);
  r.write(r.files.source, `export const unused = 1; // ${LINT_ERROR}\n`);
  const off = r.module.afterEdit(
    base(r, { agent: 'parent', files: [r.files.source], env: { KNU_EDIT_SENSORS: '0' } }),
  );
  assert.deepEqual([off.message, off.records], [null, []]);
  assert.deepEqual(r.stubCalls(), [], 'no tool runs with the switch off');
  assert.equal(
    r.module.beforeEnd(base(r, { agent: 'parent', env: { KNU_EDIT_SENSORS: '0' } })).message,
    null,
  );
  assert.deepEqual(r.records(), []);

  r.write(r.files.source, 'export const value = 2;\n');
  const quiet = r.module.afterEdit(base(r, { agent: 'parent', files: [r.files.source] }));
  assert.equal(quiet.message, null, 'no reminder by default');
  const on = { KNU_EDIT_REMINDERS: '1' };
  const first = r.module.afterEdit(base(r, { agent: 'parent', files: [r.files.source], env: on }));
  const reminders = (records) => records.filter(({ result }) => result === 'reminder');
  assert.equal(reminders(first.records).length, 3, 'three reminders a point at most');
  assert.match(first.message, /요구를 지키는가\?/u);
  assert.match(
    first.message,
    /web trigger 질문인가\?/u,
    'an item whose trigger matches the file is chosen',
  );
  const second = r.module.afterEdit(base(r, { agent: 'parent', files: [r.files.source], env: on }));
  const seen = new Set(reminders(first.records).flatMap(({ criteria }) => criteria));
  assert.ok(reminders(second.records).length > 0);
  for (const record of reminders(second.records))
    for (const id of record.criteria) assert.ok(!seen.has(id), `${id} reminded twice in a session`);
  // A file the trigger does not match never gets that item.
  const other = await repo(t);
  const pkg = other.module.EDIT_SENSOR_WORKSPACES.find(({ dir }) =>
    dir.startsWith('packages/'),
  ).dir;
  other.write(`${pkg}/src/x.ts`, 'export const x = 1;\n');
  const outside = other.module.afterEdit(
    base(other, { agent: 'parent', files: [`${pkg}/src/x.ts`], env: on }),
  );
  assert.doesNotMatch(outside.message ?? '', /web trigger 질문인가\?/u);
});

// RED 6: an existing test changed or deleted is marked once; tests deleted before the session are not.
test('existing tests are marked when changed or deleted during the session, once, and never block', async (t) => {
  const r = await repo(t);
  r.remove(r.files.keptTest); // deleted before the session started: the baseline holds it
  assert.equal(r.module.recordParentBaseline(base(r)).result, 'recorded');
  const changed = r.module.afterEdit(base(r, { agent: 'parent', files: [r.files.oldTest] }));
  assert.match(changed.message, /sensor\.test-change/u);
  assert.ok(changed.message.includes(CRITERIA_ITEMS.test.guidance));
  assert.deepEqual(results(changed.records), ['sensor.test-change:warning']);
  r.write(`${r.module.EDIT_SENSOR_WORKSPACES[0].dir}/src/new.test.ts`, 'new\n');
  const created = r.module.afterEdit(
    base(r, {
      agent: 'parent',
      files: [`${r.module.EDIT_SENSOR_WORKSPACES[0].dir}/src/new.test.ts`],
    }),
  );
  assert.equal(created.message, null, 'a new test file is not an existing test');
  // A second SessionStart (compact) keeps the first baseline, so a test deleted in between is still marked.
  r.remove(r.files.oldTest); // a Bash deletion: no edit hook saw it
  assert.equal(r.module.recordParentBaseline(base(r)).result, 'exists');
  const end = r.module.beforeEnd(base(r, { agent: 'parent', stopHookActive: false }));
  assert.match(end.message, new RegExp(r.files.oldTest.replaceAll('.', '\\.'), 'u'));
  assert.doesNotMatch(
    end.message,
    /kept\.test\.ts/u,
    'a deletion before the session is not marked',
  );
  assert.deepEqual(results(end.records.filter(({ sensor }) => sensor === 'sensor.test-change')), [
    'sensor.test-change:warning',
  ]);
  const again = r.module.beforeEnd(base(r, { agent: 'parent', stopHookActive: false }));
  assert.equal(again.message, null, 'the same deletion is marked once a session');
  // A Codex patch that deletes a test file is marked right after the edit.
  const codex = await repo(t);
  assert.equal(
    codex.module.recordParentBaseline(base(codex, { host: 'codex' })).result,
    'recorded',
  );
  codex.remove(codex.files.keptTest);
  const deleted = codex.module.afterEdit(
    base(codex, { host: 'codex', agent: 'parent', files: [], deleted: [codex.files.keptTest] }),
  );
  assert.match(deleted.message, /kept\.test\.ts/u);
  assert.deepEqual(results(deleted.records), ['sensor.test-change:warning']);
});

test('a baseline over its five seconds records timeout and the end check then records the deletion check skipped', async (t) => {
  const r = await repo(t);
  const git = stubCommand(t, 'git', { sleepSeconds: 7 });
  const started = Date.now();
  const baseline = r.module.recordParentBaseline(base(r, { env: { PATH: git.path } }));
  assert.ok(Date.now() - started < 6500, 'the baseline stops at its limit');
  assert.equal(baseline.result, 'timeout');
  assert.deepEqual(results(r.records()), ['sensor.test-change:timeout']);
  r.remove(r.files.oldTest);
  const end = r.module.beforeEnd(base(r, { agent: 'parent', stopHookActive: false }));
  assert.doesNotMatch(end.message ?? '', /old\.test\.ts/u);
  assert.ok(
    results(end.records).includes('sensor.test-change:skipped'),
    results(end.records).join(),
  );
});

// RED 8: the record format and the false positive candidates: a fail whose file is unchanged at the agent's end.
test('the summary counts activations by sensor and criteria item and the unchanged fails as false positive candidates', async (t) => {
  const r = await repo(t);
  r.write(r.files.source, `export const unused = 1; // ${LINT_ERROR}\n`);
  r.module.afterEdit(base(r, { agent: 'parent', files: [r.files.source] }));
  const end = r.module.beforeEnd(base(r, { agent: 'parent', stopHookActive: false }));
  const repeat = end.records.find(({ unchangedSince }) => unchangedSince);
  assert.ok(repeat, 'the unchanged lint fail is recorded at the end');
  assert.deepEqual([repeat.sensor, repeat.point, repeat.result], ['sensor.lint', '끝', 'fail']);
  // A hook-side Codex record is read from its own place.
  mkdirSync(join(r.root, '.codex/state/knu-edit-sensors'), { recursive: true });
  writeFileSync(
    join(r.root, '.codex/state/knu-edit-sensors', `${SESSION}.jsonl`),
    `${JSON.stringify({ schema: 'edit-sensor-activation/v1', at: '2026-11-21T00:00:00.000Z', host: 'codex', sessionId: SESSION, agent: 'parent', point: '직후', sensor: null, criteria: [], file: null, sha256: null, result: 'skipped', detail: 'codex-not-found' })}\n`,
  );
  const summary = r.module.summarizeEditSensors(r.root);
  assert.equal(summary.schema, 'edit-sensor-summary/v1');
  assert.equal(summary.falsePositiveCandidates, 1);
  assert.equal(summary.bySensor['sensor.lint'].fail, 2);
  assert.equal(summary.bySensor['(hook)'].skipped, 1);
  assert.equal(summary.byCriteria[`swe.md ${CRITERIA_ITEMS.lint.id}`], 2);
  const cli = spawnSync(process.execPath, [MODULE, '--summary', '--root', r.root], {
    encoding: 'utf8',
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), summary);
});

// RED 10: the sensors run the tools in check mode and leave the working tree as it was.
test('the sensors leave git status --short unchanged', async (t) => {
  const r = await repo(t);
  r.write(
    r.files.source,
    `export const unused: number = 'x'; // ${LINT_ERROR} ${TYPE_ERROR} ${UNFORMATTED}\n`,
  );
  const before = r.status();
  r.module.recordParentBaseline(base(r));
  r.module.afterEdit(base(r, { agent: 'parent', files: [r.files.source] }));
  r.module.beforeEnd(base(r, { agent: 'parent', stopHookActive: false }));
  assert.equal(r.status(), before);
});

test('the Codex CLI entry runs one event inside the sandbox and prints the feedback as JSON', async (t) => {
  const r = await repo(t);
  r.write(r.files.source, `export const unused = 1; // ${LINT_ERROR}\n`);
  const run = (...args) =>
    spawnSync(process.execPath, [MODULE, 'codex', '--root', r.root, ...args], { encoding: 'utf8' });
  const edit = run(
    '--event',
    'PostToolUse',
    '--session',
    SESSION,
    '--agent',
    'parent',
    '--files',
    JSON.stringify([r.files.source]),
    '--deleted',
    '[]',
    '--reminders',
    '0',
    '--stop-hook-active',
    '0',
    '--deadline-ms',
    '7000',
  );
  assert.equal(edit.status, 0, edit.stderr);
  const output = JSON.parse(edit.stdout);
  assert.match(output.additionalContext, /sensor\.lint/u);
  assert.deepEqual(
    r.records().map(({ host }) => host),
    ['codex'],
  );
  const stop = run(
    '--event',
    'Stop',
    '--session',
    SESSION,
    '--agent',
    'parent',
    '--files',
    '[]',
    '--deleted',
    '[]',
    '--reminders',
    '0',
    '--stop-hook-active',
    '0',
    '--deadline-ms',
    '29000',
  );
  assert.equal(stop.status, 0, stop.stderr);
  assert.equal(typeof JSON.parse(stop.stdout), 'object');
  const usage = run('--event', 'Nope');
  assert.equal(usage.status, 2);
});
