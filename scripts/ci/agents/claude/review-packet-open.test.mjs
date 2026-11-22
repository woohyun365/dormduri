import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repo = resolve(import.meta.dirname, '../../../..');
const tool = resolve(repo, 'scripts/agents/claude/review-packet-open.mjs');
// Loaded inside each test so a missing tool fails that test with its own reason.
async function load() {
  assert.ok(existsSync(tool), 'scripts/agents/claude/review-packet-open.mjs exists');
  return import(tool);
}

const PACKETS = '.artifacts/tools/claude-review-packets';
const TASKS = '.artifacts/tools/claude-native';
const TARGET = '.plans/sample-plan.md';
const NOW = '2026-11-22T12:00:00.000Z';
const at = (time) => `2026-11-22T${time}:00.000Z`;

// A repository with review packets and reviewer task records in the shape the helper and the registry write: the
// inputs manifest (`files` keys, `copies[*].original`), the open and settled records beside the packet, and per task
// `task.json` with the packet line (Parent reviewer) or the packet id (native subject reviewer) and the marker files.
function registry(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-packet-open-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, PACKETS), { recursive: true });
  mkdirSync(join(root, TASKS), { recursive: true });
  const packet = (reviewId, { files = {}, copies, open = true, settledBy, inputsText } = {}) => {
    const manifest = {
      schema: copies ? 'claude-review-inputs/v2' : 'claude-review-inputs/v1',
      reviewId,
      files,
    };
    if (copies) manifest.copies = copies;
    writeFileSync(
      join(root, PACKETS, `${reviewId}.inputs.json`),
      inputsText ?? JSON.stringify(manifest),
    );
    if (open)
      writeFileSync(
        join(root, PACKETS, `${reviewId}.open.json`),
        JSON.stringify({ reviewId, closedBy: `${reviewId}.settled.json` }),
      );
    if (settledBy)
      writeFileSync(
        join(root, PACKETS, `${reviewId}.settled.json`),
        JSON.stringify({
          taskId: settledBy,
          settledAt: at('11:30'),
          valid: true,
          observationErrors: [],
        }),
      );
  };
  const task = (
    reviewId,
    {
      native = false,
      role = 'knu_reviewer',
      issuedAt = at('10:00'),
      expiresAt = at('10:15'),
      launched = true,
      completed = false,
      invalid = false,
      taskRoot = root,
    } = {},
  ) => {
    const taskId = randomUUID();
    const dir = join(root, TASKS, taskId);
    mkdirSync(dir);
    const prompt = native
      ? 'Review the subject.'
      : `Review.\nKNU_REVIEW_PACKET_FILE:${PACKETS}/${reviewId}.json sha256:${'0'.repeat(64)}\nRead it first.`;
    writeFileSync(
      join(dir, 'task.json'),
      JSON.stringify({
        record: {
          version: 1,
          taskId,
          root: taskRoot,
          sessionId: randomUUID(),
          prompt,
          independentReview: native ? { packet: { packetId: `review-${reviewId}` } } : null,
          input: { nativeRequest: { issuedAt, expiresAt, task: { role } } },
        },
        invocation: { subagent_type: role, prompt },
      }),
    );
    if (launched) writeFileSync(join(dir, 'launch.json'), '{}');
    if (completed) writeFileSync(join(dir, 'completion.json'), '{}');
    if (invalid) writeFileSync(join(dir, 'observation-error.json'), '{"reason":"released"}');
    return taskId;
  };
  return { root, packet, task };
}

const bound = { files: { [TARGET]: `sha256:${'1'.repeat(64)}` } };
const copied = {
  files: {},
  copies: {
    [`${PACKETS}/b0000002-00000002.inputs/${TARGET}`]: {
      original: TARGET,
      digest: `sha256:${'2'.repeat(64)}`,
    },
  },
};

test('packets binding a path are open, closed or not open by the same-host review rule (P6 ③ Owner 1.4)', async (t) => {
  const { checkOpenPackets } = await load();
  const r = registry(t);
  // Closed: the settled record names the basis task.
  r.packet('a0000001-00000001', {
    ...bound,
    settledBy: r.task('a0000001-00000001', { completed: true }),
  });
  // Open: a v2 manifest binds the path through a copy and nothing settled the basis task.
  r.packet('b0000002-00000002', copied);
  r.task('b0000002-00000002');
  // A packet without an open record (written before the helper wrote one) is closed by the basis task's completion,
  // and open without it.
  r.packet('c0000003-00000003', { ...bound, open: false });
  r.task('c0000003-00000003', { completed: true });
  r.packet('c0000004-00000004', { ...bound, open: false });
  r.task('c0000004-00000004');
  // No basis task: the only reviewer task was released (observation-error.json), or it names another root.
  r.packet('d0000005-00000005', bound);
  r.task('d0000005-00000005', { invalid: true });
  r.packet('d0000006-00000006', bound);
  r.task('d0000006-00000006', { taskRoot: '/elsewhere/checkout' });
  // Registered again: the later task is the basis, so the earlier settlement no longer closes the packet.
  const earlier = r.task('e0000007-00000007', { issuedAt: at('09:00'), completed: true });
  r.packet('e0000007-00000007', { ...bound, settledBy: earlier });
  r.task('e0000007-00000007', { issuedAt: at('11:00') });
  // A basis task that expired without a launch cannot be dispatched any more: counted apart, not open.
  r.packet('f0000008-00000008', bound);
  r.task('f0000008-00000008', { issuedAt: at('08:00'), expiresAt: at('08:15'), launched: false });
  // A native subject reviewer names the packet by its packet id.
  r.packet('a0000009-00000009', bound);
  r.task('a0000009-00000009', { native: true });
  // An unreadable manifest of an open packet may bind the path.
  r.packet('b000000a-0000000a', { inputsText: '{' });
  r.task('b000000a-0000000a');
  // A task of another role is no basis task (not open), and a manifest that binds another path is not listed.
  r.packet('c000000b-0000000b', bound);
  r.task('c000000b-0000000b', { role: 'knu_explorer' });
  r.packet('d000000c-0000000c', { files: { 'docs/other.md': `sha256:${'3'.repeat(64)}` } });
  r.task('d000000c-0000000c');

  const result = checkOpenPackets({ root: r.root, paths: [TARGET], now: Date.parse(NOW) });
  assert.deepEqual(
    result.packets.map(({ reviewId, state }) => [reviewId, state]),
    [
      ['a0000001-00000001', 'closed'],
      ['a0000009-00000009', 'open'],
      ['b0000002-00000002', 'open'],
      ['b000000a-0000000a', 'open-unreadable-inputs'],
      ['c0000003-00000003', 'closed'],
      ['c0000004-00000004', 'open'],
      ['c000000b-0000000b', 'not-open'],
      ['d0000005-00000005', 'not-open'],
      ['d0000006-00000006', 'not-open'],
      ['e0000007-00000007', 'open'],
      ['f0000008-00000008', 'open-expired-unlaunched'],
    ],
  );
  assert.equal(result.summary.open, 5);
  assert.equal(result.summary.expiredUnlaunched, 1);
  // A directory path binds the files under it.
  const directory = checkOpenPackets({ root: r.root, paths: ['.plans'], now: Date.parse(NOW) });
  assert.equal(directory.packets.length, result.packets.length);
  assert.equal(
    checkOpenPackets({
      root: r.root,
      paths: ['.plans/other.md'],
      now: Date.parse(NOW),
    }).packets.filter(({ state }) => state !== 'open-unreadable-inputs').length,
    0,
  );
});

test('the command line exits 1 when an open packet binds a path and 0 otherwise (P6 ③ Owner 1.4)', async (t) => {
  await load();
  const r = registry(t);
  r.packet('a0000001-00000001', {
    ...bound,
    settledBy: r.task('a0000001-00000001', { completed: true }),
  });
  r.packet('d000000c-0000000c', { files: { 'docs/other.md': `sha256:${'3'.repeat(64)}` } });
  r.task('d000000c-0000000c');
  const cli = (...args) =>
    spawnSync(process.execPath, [tool, ...args], { cwd: r.root, encoding: 'utf8' });
  const closed = cli('--paths', TARGET, '--now', NOW);
  assert.equal(closed.status, 0, closed.stderr);
  assert.match(closed.stdout, /a0000001-00000001\tclosed\t/u);
  const open = cli('--paths', `${TARGET},docs/other.md`, '--now', NOW, '--json');
  assert.equal(open.status, 1, open.stderr);
  assert.deepEqual(
    JSON.parse(open.stdout).packets.map(({ reviewId, state, boundPaths }) => [
      reviewId,
      state,
      boundPaths,
    ]),
    [
      ['a0000001-00000001', 'closed', [TARGET]],
      ['d000000c-0000000c', 'open', ['docs/other.md']],
    ],
  );
  for (const args of [
    [],
    [TARGET],
    ['--paths', TARGET, '--now', 'yesterday'],
    ['--paths', TARGET, '--bogus'],
  ]) {
    const refused = cli(...args);
    assert.equal(refused.status, 2, `${args.join(' ')}: ${refused.stdout}`);
    assert.ok(refused.stderr.length > 0, args.join(' '));
  }
});

// The tool reads the records the helper and the registry write, and the same-host review rule points at it.
test('the open packet rule names the tool and the tool reads the records the helper writes (P6 ③ Owner 1.4)', async () => {
  await load();
  const helper = readFileSync(
    resolve(repo, 'scripts/agents/claude/native-task-helper.mjs'),
    'utf8',
  );
  for (const name of ['KNU_REVIEW_PACKET_FILE:', '.open.json', '.settled.json', '.inputs.json'])
    assert.ok(helper.includes(name), `helper writes ${name}`);
  const session = readFileSync(resolve(repo, 'scripts/agents/claude/native-session.mjs'), 'utf8');
  for (const name of ["'observation-error.json'", "'completion.json'", "'launch.json'"])
    assert.ok(session.includes(name), `registry writes ${name}`);
  const rule = readFileSync(
    resolve(repo, 'docs/development/agent-workflows/adapters/claude-same-host-review.md'),
    'utf8',
  ).replace(/\s+/gu, ' ');
  assert.ok(
    rule.includes('`node scripts/agents/claude/review-packet-open.mjs --paths <경로>[,<경로>…]`'),
    'the open packet paragraph names the tool',
  );
});
