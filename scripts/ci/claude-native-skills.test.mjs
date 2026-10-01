import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { buildTaskEnvelope } from '../agents/common/index.mjs';
import { evaluateClaudeProfileEligibility } from '../agents/claude/model-policy.mjs';
import { prepareClaudeNativeTask } from '../agents/claude/native-task-helper.mjs';
import { handleClaudeNativeSessionEvent } from '../agents/claude/native-session.mjs';
import {
  ROLE_EFFORT,
  fixture,
  writeChildTranscript,
} from './fixtures/claude-native-session-fixture.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const SKILLS = ['knu-delegate', 'knu-review', 'knu-settle'];
const REJECTIONS =
  'docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md';
const ACTIONS = new Set(['prepare', 'review', 'settle', 'release']);
const FILE_FLAGS = new Set(['--spec', '--parent-subject', '--runner-evidence', '--judgment']);
const COMMAND_PREFIX = /^pnpm -C "\$\{CLAUDE_PROJECT_DIR\}" -s claude:native (\S+)(.*)$/u;

// The helper owns spec keys and CLI flags; read them from source so the skills cannot drift.
function sourceArray(source, name) {
  const body = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`, 'u').exec(source)?.[1] ?? '';
  return [...body.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
}
function helperFlags() {
  const source = read('scripts/agents/claude/native-session.mjs');
  const parsers = source.slice(
    source.indexOf('const REVIEW_OPTIONS'),
    source.indexOf('async function main'),
  );
  const release = source.slice(
    source.indexOf("if (action === 'release')"),
    source.indexOf('for (let i = 0; i < args.length; i += 2)', source.indexOf("'release'")),
  );
  return new Set([...`${parsers}${release}`.matchAll(/'(--[a-z-]+)'/gu)].map((m) => m[1]));
}

function frontmatter(text) {
  const block = /^---\n([\s\S]*?)\n---\n/u.exec(text)?.[1];
  if (block === undefined) return null;
  return Object.fromEntries(
    block.split('\n').map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
}
function skillIssues(text, directory) {
  const meta = frontmatter(text);
  if (!meta) return ['frontmatter'];
  const issues = [];
  if (Object.keys(meta).sort().join() !== 'description,name') issues.push('keys');
  if (meta.name !== directory) issues.push('name');
  if (!meta.description) issues.push('description');
  if (/^!`/mu.test(text)) issues.push('inline-injection');
  if (/^```!/mu.test(text)) issues.push('block-injection');
  return issues;
}

function commandsIn(text) {
  return [
    ...text.matchAll(/(?:pnpm|node)\b[^\n`]*(?:claude:native|native-session\.mjs)[^\n`]*/gu),
  ].map((match) => match[0].trim());
}
function commandIssues(command, flags) {
  const match = COMMAND_PREFIX.exec(command);
  if (!match) return ['form'];
  const issues = [];
  if (!ACTIONS.has(match[1])) issues.push(`action:${match[1]}`);
  const tokens = match[2].trim().split(/\s+/u).filter(Boolean);
  tokens.forEach((token, index) => {
    if (!token.startsWith('--')) return;
    if (!flags.has(token)) issues.push(`flag:${token}`);
    const value = tokens[index + 1]?.replace(/^"|"$/gu, '');
    if (FILE_FLAGS.has(token) && !/^(\/|\$\{CLAUDE_PROJECT_DIR\}|<)/u.test(value ?? ''))
      issues.push(`relative:${token}`);
  });
  return issues;
}

// Required facts per kind, as the rejection document lists them.
function documentedFacts() {
  const rows = [
    ...read(REJECTIONS).matchAll(/^\s*\|\s*`(extract|read|build|review)`\s*\|(.+)\|\s*$/gmu),
  ];
  return Object.fromEntries(
    rows.map(([, kind, cell]) => [kind, [...cell.matchAll(/`([^`]+)`/gu)].map((m) => m[1])]),
  );
}
const KIND_PROBE = {
  extract: { profileId: 'bounded-extraction', role: 'knu_explorer', request: '분석해줘' },
  read: { profileId: 'bounded-standard', role: 'knu_explorer', request: '분석해줘' },
  build: { profileId: 'bounded-standard', role: 'knu_executor', request: '구현해줘' },
  review: { profileId: 'complex-critical', role: 'knu_reviewer', request: '리뷰해줘' },
};
const TOOLS = {
  knu_explorer: ['Read', 'Grep', 'Glob'],
  knu_executor: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  knu_reviewer: ['Read', 'Grep', 'Glob'],
};
function eligibility(kind, factKeys) {
  const probe = KIND_PROBE[kind];
  const writing = kind === 'build';
  const envelope = buildTaskEnvelope({ request: `sample.txt 내용을 ${probe.request}.` });
  const issuedAt = new Date();
  return evaluateClaudeProfileEligibility({
    envelope,
    profileId: probe.profileId,
    selectedBy: 'lead',
    selectionBasisRef: 'plan:skills-test/facts',
    task: {
      taskId: 'skills-test',
      kind,
      impactRisk: envelope.risk,
      complexity: 'bounded',
      uncertainty: 'resolved',
      role: probe.role,
      allowedTools: [...TOOLS[probe.role]],
      readScope: ['sample.txt'],
      writeScope: writing ? ['sample.txt'] : [],
      writeOwner: writing ? 'builder' : null,
      childValue: 'independent-verification',
      independent: true,
      knownGaps: [],
      facts: factKeys.map((key) => ({ key, sourceRef: 'plan:skills-test', confidence: 'high' })),
    },
    sourceDigest: `sha256:${'1'.repeat(64)}`,
    configDigest: `sha256:${'2'.repeat(64)}`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 15 * 60 * 1000).toISOString(),
  });
}

const skill = (name) => read(`.claude/skills/${name}/SKILL.md`);
const good = '---\nname: knu-x\ndescription: Use when delegating.\n---\n\nBody.\n';

test('skill and command checks reject bad synthetic input before reading real skills', () => {
  assert.deepEqual(skillIssues(good, 'knu-x'), []);
  for (const [bad, issue, directory = 'knu-x'] of [
    [good.replace('description:', 'allowed-tools: Bash\ndescription:'), 'keys'],
    [good.replace('description:', 'hooks: {}\ndescription:'), 'keys'],
    [good.replace('description:', 'model: opus\ndescription:'), 'keys'],
    [`${good}\n\`\`\`!\ngit status\n\`\`\`\n`, 'block-injection'],
    [`${good}\n!\`git status\`\n`, 'inline-injection'],
    [good, 'name', 'knu-y'],
  ])
    assert.ok(skillIssues(bad, directory).includes(issue), issue);

  const flags = helperFlags();
  assert.ok(flags.size >= 5, 'helper flags must be read from source');
  const ok = 'pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native prepare --spec <spec.json>';
  assert.deepEqual(commandIssues(ok, flags), []);
  for (const bad of [
    'pnpm claude:native register --input x',
    'pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native register --input /x.json',
    'pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native complete --task x',
    'pnpm -s claude:native prepare --spec /a.json',
    'node scripts/agents/claude/native-session.mjs prepare --spec spec.json',
    'pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native prepare --spec spec.json',
    'pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native settle --task x --unknown y',
  ])
    assert.notDeepEqual(commandIssues(bad, flags), [], bad);
  assert.equal(
    commandsIn(`run \`node scripts/agents/claude/native-session.mjs settle\``).length,
    1,
  );
});

test('KNU procedure skills are tracked, name-only frontmatter, and grant nothing', () => {
  for (const name of SKILLS) {
    const path = `.claude/skills/${name}/SKILL.md`;
    assert.ok(existsSync(resolve(root, path)), `${path}: missing`);
    const ignored = spawnSync('git', ['check-ignore', '--no-index', '-q', path], { cwd: root });
    assert.equal(ignored.status, 1, `${path}: must be tracked`);
    assert.deepEqual(skillIssues(skill(name), name), [], path);
  }
});

test('the delegate template passes prepare and the rejection document binds facts to policy', (t) => {
  const template = /```json\n([\s\S]*?)\n```/u.exec(skill('knu-delegate'))?.[1];
  assert.ok(template, 'knu-delegate needs a json template');
  for (const name of ['knu-delegate', 'knu-review'])
    assert.ok(skill(name).includes('${CLAUDE_SESSION_ID}'), name);
  assert.match(skill('knu-delegate'), /claude-native-registration-and-review-rejections\.md#원인/u);

  const helper = read('scripts/agents/claude/native-task-helper.mjs');
  const required = sourceArray(helper, 'SPEC_REQUIRED');
  const allowed = new Set([...required, ...sourceArray(helper, 'SPEC_OPTIONAL')]);
  assert.ok(required.length >= 10, 'spec keys must be read from source');
  const spec = JSON.parse(template.replaceAll('${CLAUDE_SESSION_ID}', randomUUID()));
  assert.deepEqual(
    required.filter((key) => !Object.hasOwn(spec, key)),
    [],
  );
  assert.deepEqual(
    Object.keys(spec).filter((key) => !allowed.has(key)),
    [],
  );

  const f = fixture(t);
  writeFileSync(join(f.root, 'package.json'), '{ "packageManager": "pnpm@0.0.0" }\n');
  execFileSync('git', ['add', '.'], { cwd: f.root });
  const repo = realpathSync(f.root);
  assert.ok(prepareClaudeNativeTask(structuredClone(spec), { root: repo }).taskId);
  assert.throws(
    () => prepareClaudeNativeTask({ ...spec, readScope: [] }, { root: repo }),
    /invalid-input/u,
  );
  assert.throws(
    () => prepareClaudeNativeTask({ ...spec, facts: spec.facts.slice(1) }, { root: repo }),
    /required-facts/u,
  );

  const rejections = read(REJECTIONS);
  assert.match(rejections, /`readScope`[^\n]*`invalid-input`/u);
  const documented = documentedFacts();
  assert.deepEqual(Object.keys(documented).sort(), ['build', 'extract', 'read', 'review']);
  for (const [kind, keys] of Object.entries(documented)) {
    assert.ok(keys.length > 0, kind);
    assert.deepEqual(eligibility(kind, keys).reasons, [], `${kind}: documented facts suffice`);
    for (const key of keys)
      assert.ok(
        eligibility(
          kind,
          keys.filter((other) => other !== key),
        ).reasons.includes('required-facts'),
        `${kind}: ${key} must be required`,
      );
  }
});

test('skills guide only helper actions in the project-rooted form', () => {
  const flags = helperFlags();
  for (const name of SKILLS) {
    const commands = commandsIn(skill(name));
    assert.ok(commands.length > 0, `${name}: no helper command`);
    for (const command of commands) assert.deepEqual(commandIssues(command, flags), [], command);
    assert.doesNotMatch(skill(name), /register --input|claude:native complete/u, name);
  }
});

test('CLAUDE.md points to the skills instead of low-level registration', () => {
  const entry = read('CLAUDE.md');
  assert.doesNotMatch(entry, /register --input/u);
  assert.match(entry, /\/knu-delegate/u);
});

// The recovery example is the second json block: fields merged onto the delegate template.
test('the delegate recovery example binds a retry to a ran, unaccepted first task', (t) => {
  const blocks = [...skill('knu-delegate').matchAll(/```json\n([\s\S]*?)\n```/gu)].map((m) => m[1]);
  assert.equal(blocks.length, 2, 'knu-delegate needs the template and a recovery example');
  const sessionId = randomUUID();
  const template = JSON.parse(blocks[0].replaceAll('${CLAUDE_SESSION_ID}', sessionId));
  const example = JSON.parse(blocks[1]);
  const helper = read('scripts/agents/claude/native-task-helper.mjs');
  const allowed = new Set([
    ...sourceArray(helper, 'SPEC_REQUIRED'),
    ...sourceArray(helper, 'SPEC_OPTIONAL'),
  ]);
  assert.ok(allowed.has('recovery'), 'recovery is a helper spec field');
  assert.deepEqual(
    Object.keys(example).filter((key) => !allowed.has(key)),
    [],
  );
  assert.deepEqual(Object.keys(example.recovery).sort(), ['cause', 'of']);

  const f = fixture(t);
  writeFileSync(join(f.root, 'package.json'), '{ "packageManager": "pnpm@0.0.0" }\n');
  writeFileSync(join(f.root, '.git/info/exclude'), '.artifacts/\n');
  execFileSync('git', ['add', '.'], { cwd: f.root });
  const repo = realpathSync(f.root);
  const first = prepareClaudeNativeTask(structuredClone(template), { root: repo });
  const event = {
    hook_event_name: 'PreToolUse',
    session_id: sessionId,
    cwd: repo,
    permission_mode: 'auto',
    tool_name: 'Agent',
    tool_use_id: 'first-1',
    tool_input: first.invocation,
  };
  assert.deepEqual(handleClaudeNativeSessionEvent(event, { root: repo }), {});
  const model = first.registerInput.expectedResolvedModel;
  handleClaudeNativeSessionEvent(
    {
      ...event,
      hook_event_name: 'PostToolUse',
      transcript_path: writeChildTranscript(repo, {
        sessionId,
        agentId: 'first-1-agent',
        prompt: first.invocation.prompt,
        model,
        effort: ROLE_EFFORT[first.invocation.subagent_type],
      }),
      tool_response: {
        status: 'completed',
        agentId: 'first-1-agent',
        resolvedModel: model,
        content: [{ type: 'text', text: 'partial answer' }],
      },
    },
    { root: repo },
  );
  const retry = { ...template, ...example, recovery: { ...example.recovery, of: first.taskId } };
  assert.ok(prepareClaudeNativeTask(retry, { root: repo }).taskId);
});

test('settle, registry and qualification documents carry the E2 recovery and pilot rules', () => {
  const settle = skill('knu-settle');
  assert.match(settle, /`parent-adjudication` reviewer:[^\n]*\n?[^\n]*`observationErrors`/u);
  assert.ok(!settle.includes('`completion.json`의 관측(valid'), 'old settle basis remains');
  const registry = read('docs/development/agent-workflows/adapters/claude-native-registry.md');
  assert.match(registry, /선택 필드는[^\n]*`recovery`/u);
  for (const reason of [
    'recovery-cause',
    'recovery-not-bound',
    'recovery-chain',
    'recovery-step',
    'recovery-not-ran',
    'recovery-accepted',
    'recovery-used',
  ])
    assert.ok(registry.includes(`\`${reason}\``), `registry names ${reason}`);
  const section = registry.slice(registry.indexOf('## Recovery 결속'));
  const order = [
    'recovery-cause',
    'recovery-not-bound',
    'recovery-chain',
    'recovery-step',
    'recovery-not-ran',
    'recovery-accepted',
    'recovery-used',
  ].map((reason) => section.indexOf(`\`${reason}\``));
  assert.ok(
    order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])),
    `judging order ${order}`,
  );
  for (const file of ['accepted.json', 'recovery.json'])
    assert.ok(registry.includes(`\`${file}\``), `registry names ${file}`);
  const start = 'claude --permission-mode auto --model opus --effort high';
  for (const path of [
    'docs/development/agent-workflows/adapters/claude-qualification.md',
    'docs/development/troubleshooting/tooling/claude-live-session-from-claude-session.md',
  ]) {
    const text = read(path);
    assert.ok(text.includes(start), `${path}: pilot start command`);
    assert.ok(text.includes('`/effort`'), `${path}: /effort rule`);
  }
});

test('review and settle documents carry the E3 packet file and its settle reasons', () => {
  const review = skill('knu-review');
  assert.ok(review.includes('KNU_REVIEW_PACKET_FILE'), 'knu-review names the packet file line');
  assert.ok(
    !review.includes('넘으면 acceptance·read path·runner 기록을 줄입니다'),
    'old limit advice',
  );
  assert.match(review, /packet[^\n]*빠진 뒤/u);
  for (const path of [
    '.claude/skills/knu-settle/SKILL.md',
    'docs/development/agent-workflows/adapters/claude-same-host-review.md',
    'docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md',
  ]) {
    const text = read(path);
    for (const reason of ['review-packet-unread', 'review-packet-changed'])
      assert.ok(text.includes(`\`${reason}\``), `${path}: ${reason}`);
  }
});
