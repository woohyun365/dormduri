import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { buildTaskEnvelope } from '../../../agents/common/index.mjs';
import { evaluateClaudeProfileEligibility } from '../../../agents/claude/model-policy.mjs';
import { prepareClaudeNativeTask } from '../../../agents/claude/native-task-helper.mjs';
import { handleClaudeNativeSessionEvent } from '../../../agents/claude/native-session.mjs';
import {
  ROLE_EFFORT,
  fixture,
  writeChildTranscript,
} from './fixtures/claude-native-session-fixture.mjs';
import {
  DISPATCH_BULLETS,
  DISPATCH_STEPS,
  dispatchSection,
  missingDispatchPhrases,
} from '../common/fixtures/knu-review-dispatch-steps.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const SKILLS = ['knu-delegate', 'knu-review', 'knu-settle'];
const REJECTIONS =
  'docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md';
const ACTIONS = new Set(['prepare', 'review', 'review-run', 'settle', 'release']);
const FILE_FLAGS = new Set([
  '--spec',
  '--parent-subject',
  '--runner-evidence',
  '--previous-result',
  '--judgment',
]);
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
  const rows = [...read(REJECTIONS).matchAll(/^\s*\|\s*`(extract|read|review)`\s*\|(.+)\|\s*$/gmu)];
  return Object.fromEntries(
    rows.map(([, kind, cell]) => [kind, [...cell.matchAll(/`([^`]+)`/gu)].map((m) => m[1])]),
  );
}
const KIND_PROBE = {
  extract: { profileId: 'bounded-extraction', role: 'knu_explorer_xhigh', request: '분석해줘' },
  read: { profileId: 'bounded-standard', role: 'knu_explorer', request: '분석해줘' },
  review: { profileId: 'complex-critical', role: 'knu_reviewer', request: '리뷰해줘' },
};
const TOOLS = {
  knu_explorer: ['Read', 'Grep', 'Glob'],
  knu_explorer_xhigh: ['Read', 'Grep', 'Glob'],
  knu_reviewer: ['Read', 'Grep', 'Glob'],
};
function eligibility(kind, factKeys) {
  const probe = KIND_PROBE[kind];
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
      writeScope: [],
      writeOwner: null,
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
  assert.deepEqual(Object.keys(documented).sort(), ['extract', 'read', 'review']);
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
  // Building a review packet needs the round; a documented command without it is refused.
  const packetCommands = commandsIn(skill('knu-review')).filter((command) =>
    command.includes('--runner-evidence'),
  );
  assert.equal(packetCommands.length, 2);
  for (const command of packetCommands) assert.match(command, / --round <N>(?: |$)/u, command);
});

// The review skill names the composition flags and the dispatch-step tools that actually exist.
test('the review skill names real composition flags and dispatch-step tools', () => {
  const text = skill('knu-review');
  const flags = helperFlags();
  for (const flag of ['--composition', '--reviewers']) {
    assert.ok(flags.has(flag), `${flag} is a review option`);
    assert.match(text, new RegExp(`${flag} `, 'u'), flag);
  }
  const tools = [...text.matchAll(/`([a-z-]+\.mjs)(?: [^`]*)?`/gu)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(tools)].sort(),
    [
      'citation-check.mjs',
      'mutation-harness.mjs',
      'plan-reference-check.mjs',
      'plan-shape-check.mjs',
      'red-reason-check.mjs',
      'runner-log-check.mjs',
      // OSS-RL P5: the Runner environment bullet wraps an evidence reproduction record with the read trace.
      'runner-read-trace.mjs',
    ],
    'plan review grade: dispatch-step tools',
  );
  for (const tool of tools)
    assert.ok(existsSync(resolve(root, 'scripts/agents/common', tool)), tool);
  const settle = skill('knu-settle');
  for (const [, path] of settle.matchAll(/`node (scripts\/agents\/[a-z/-]+\.mjs)/gu))
    assert.ok(existsSync(resolve(root, path)), path);
  assert.match(settle, /reviewAdjudication/u);
});

test('CLAUDE.md points to the skills instead of low-level registration', () => {
  const entry = read('CLAUDE.md');
  assert.doesNotMatch(entry, /register --input/u);
  assert.match(entry, /\/knu-delegate/u);
});

// The recovery example is the json block with a recovery field: fields merged onto the delegate template.
test('the delegate recovery example binds a retry to a ran, unaccepted first task', (t) => {
  const blocks = [...skill('knu-delegate').matchAll(/```json\n([\s\S]*?)\n```/gu)].map((m) => m[1]);
  assert.equal(
    blocks.length,
    3,
    'knu-delegate needs the template, a researcher example and a recovery example',
  );
  const sessionId = randomUUID();
  const template = JSON.parse(blocks[0].replaceAll('${CLAUDE_SESSION_ID}', sessionId));
  const example = JSON.parse(blocks.find((block) => block.includes('"recovery"')));
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

// G8: a Parent subject request carries requirements, never the change description, and the skill
// names the input checks review and registration apply to it.
// Several reviewers are for a change that meets the QA disposition trigger, and plan reviews are single at every grade
// that gets a reviewer; the dispatch steps carry the grade check and the round rules carry the delta.
function reviewSection(heading, next) {
  const text = skill('knu-review');
  const start = text.indexOf(heading);
  assert.ok(start >= 0, heading);
  return text.slice(start, next ? text.indexOf(next, start) : undefined);
}
function dispatchStep(number) {
  const steps = reviewSection('## Dispatch 전 단계', '## 1회차 다중 reviewer').split(
    /\n(?=\d+\. )/u,
  );
  return (steps.find((step) => step.startsWith(`${number}. `)) ?? '').replace(/\s+/gu, ' ');
}

test('knu-review keeps several reviewers to trigger changes and plan reviews single', () => {
  const section = reviewSection('## 1회차 다중 reviewer', '## 공통');
  const first = (section.split(/\n(?=- )/u)[1] ?? '').replace(/\s+/gu, ' ');
  for (const phrase of [
    'Independent review disposition',
    'trigger를 충족한 구현 변경의 1회차에만',
    '계획 리뷰(P2·P3)는 단일입니다',
  ])
    assert.ok(first.includes(phrase), `plan review grade: multi reviewer bullet ${phrase}`);
  const flat = skill('knu-review').replace(/\s+/gu, ' ');
  for (const old of ['Owner가 정한 변경의 1회차에만', '계획 readiness 리뷰는 단일입니다'])
    assert.ok(!flat.includes(old), `plan review grade: old sentence ${old}`);
});

test('knu-review dispatch step 1 fixes every blocking finding and searches by sentence before the next round', () => {
  const step = dispatchStep(1);
  for (const phrase of [
    'blocking 전부를 한 번에 고치고',
    '문장 단위',
    '`rg -U`',
    '저장소 전체 tracked 경로',
    '`rg --no-ignore`',
    '결정적 검사를 통과시킨 뒤',
  ])
    assert.ok(step.includes(phrase), `plan review grade: step 1 ${phrase}`);
});

test('knu-review dispatch step 5 declares the plan grade and runs the revision check', () => {
  const step = dispatchStep(5);
  for (const phrase of [
    '등급을 선언하고',
    '`plan-shape-check.mjs --revision',
    'P0는 리뷰 없음',
    'P1은 reviewer 없음',
    '`plan-reference-check.mjs`',
    '`<plan>.scope.diff`',
    '`paths`',
  ])
    assert.ok(step.includes(phrase), `plan review grade: step 5 ${phrase}`);
});

test('knu-review prompt limit bullet keeps single runner lines in the log', () => {
  const section = reviewSection('## 공통');
  const bullet = (
    section.split(/\n(?=- )/u).find((item) => item.includes('12,000자')) ?? ''
  ).replace(/\s+/gu, ' ');
  assert.ok(
    bullet.includes('runner 기록의 낱개 줄은 log에 두고 record에는 요약 조각만 둡니다'),
    'plan review grade: prompt limit bullet runner record sentence',
  );
});

test('knu-review asks for requirements in request and names the Parent subject input checks', () => {
  const text = skill('knu-review').replace(/\s+/gu, ' ');
  assert.ok(!text.includes('`request`는 검토할 변경의 설명'), 'request as change description');
  assert.match(text, /`request`는 요구사항/u);
  for (const term of [
    'requirementSections',
    'local-state-path',
    'request-implementation-marker',
    'review-prompt-changed',
  ])
    assert.ok(text.includes(term), term);
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
    for (const reason of ['review-packet-unread', 'review-packet-changed', 'review-packet-missing'])
      assert.ok(text.includes(`\`${reason}\``), `${path}: ${reason}`);
  }
});

test('settle documents keep the hand-back turn alive until the completion notification arrives', () => {
  const rule = 'hand-back을 받은 turn은 text로 끝내지 않고';
  for (const path of [
    'docs/development/agent-workflows/adapters/claude-code.md',
    '.claude/skills/knu-settle/SKILL.md',
    'docs/development/troubleshooting/tooling/claude-native-completion-observation-missing.md',
  ])
    // Line wrapping may split the sentence, so whitespace is compared as one space.
    assert.ok(read(path).replace(/\s+/gu, ' ').includes(rule), `${path}: hand-back turn rule`);
  const doc = read(
    'docs/development/troubleshooting/tooling/claude-native-completion-observation-missing.md',
  );
  assert.match(doc, /## hand-back 뒤 완료 알림이 오지 않음/u);
  assert.match(doc, /알림 없이 정산하지 않습니다/u);
  const rejections = read(
    'docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md',
  );
  const flat = rejections.replace(/\s+/gu, ' ');
  assert.ok(
    flat.includes('세 사유 모두 결과를 쓰지 말고'),
    'three packet reasons share one remedy',
  );
  assert.ok(!flat.includes('둘 다 결과를 쓰지 말고'), 'stale count');
  assert.ok(!/\bE[0-9]\b/u.test(flat), 'no plan phase label in a tracked doc');
});

// The review entry takes code review requests and picks criteria from the changed paths. A host's
// own review (built-in /code-review, Ultracode, Workflow, fork, Codex Ultra) is an advisory opinion;
// the review evidence is the registered reviewer's observation only. The snapshot ignores the stage,
// so no skill asks for `git add -N` before a review.
test('knu-review is the code review entry with automatic criteria and advisory host reviews', () => {
  const review = skill('knu-review');
  const { description } = frontmatter(review);
  for (const phrase of ['code review', '리뷰해줘']) assert.ok(description.includes(phrase), phrase);
  const flat = review.replace(/\s+/gu, ' ');
  for (const host of ['`/code-review`', 'Ultracode', 'Workflow', 'fork', 'Codex Ultra'])
    assert.ok(flat.includes(host), `host review: ${host}`);
  assert.ok(flat.includes('보조 의견'), 'host review results are advisory');
  assert.ok(flat.includes('등록한 reviewer task의 관측'), 'evidence is the registered reviewer');
  assert.ok(flat.includes('<reviewId>.criteria.json'), 'names the selection record');
  assert.ok(flat.includes('--criteria'), 'names the override');
  for (const name of ['knu-review', 'knu-delegate'])
    assert.ok(!skill(name).includes('git add -N'), `${name}: git add -N instruction remains`);
  for (const path of [
    '.claude/skills/knu-settle/SKILL.md',
    'docs/development/agent-workflows/adapters/claude-same-host-review.md',
  ])
    assert.ok(read(path).includes('`review-snapshot-mismatch`'), `${path}: logHeader comparison`);
  const snapshot = read('docs/development/agent-workflows/adapters/claude-workflow-entry.md');
  assert.ok(snapshot.includes('`claude-git-baseline/v4`'), 'digest version');
  assert.ok(!snapshot.includes('`claude-git-baseline/v3`'), 'old digest version');
});

test('the delegate skill routine table matches the adapter routine rows one to one', () => {
  const cells = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
  const routine =
    read('docs/development/agent-workflows/adapters/claude-code.md')
      .split('## Routine operation')[1]
      ?.split('## Recovery')[0] ?? '';
  const tableRows = (text, pattern) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => pattern.test(line))
      .map(cells);
  // Skill work labels are short forms of the adapter work column; each maps to exactly one adapter row.
  const WORK = new Map([
    ['고정 입력 추출', '고정 입력 추출'],
    // One researcher row: official-source research, read or extract, settled by the quote check (D-RET-8).
    ['공식 근거 조사(`read`·`extract`, 인용 대조)', '공식 근거 조사(`read`·`extract`, 인용 대조)'],
    ['repository 읽기', 'repository 읽기 조사'],
  ]);
  const status = (value) => (value.startsWith('Q') ? 'Q' : value);
  const alias = { '`haiku`': 'Haiku', '`sonnet`': 'Sonnet', '`opus`': 'Opus' };
  const adapterRows = tableRows(routine, /^\| `knu_/u)
    // knu_reviewer is dispatched by /knu-review, and a replaced row is refused at registration, so
    // neither is copied into the delegate skill.
    .filter(
      (row) =>
        row[6] !== undefined &&
        !row[6].startsWith('미사용') &&
        !row[6].startsWith('대체됨') &&
        row[0] !== '`knu_reviewer`',
    )
    .map(([role, profile, model, effort, , work, state]) => [
      `${role} ${profile} ${work}`,
      { model: `${alias[model]} ${effort}`, state: status(state) },
    ]);
  const adapter = new Map(adapterRows);
  assert.equal(
    adapter.size,
    adapterRows.length,
    'adapter routine rows are unique by role, profile and work',
  );
  const skill = tableRows(read('.claude/skills/knu-delegate/SKILL.md'), /^\| [^`|][^|]*\| `knu_/u);
  const seen = new Set();
  for (const [work, role, profile, model, state] of skill) {
    assert.ok(WORK.has(work), `${work}: unmapped skill work label`);
    const key = `${role} ${profile} ${WORK.get(work)}`;
    const row = adapter.get(key);
    assert.ok(row, `${key}: no adapter routine row`);
    assert.equal(model, row.model, `${key}: model and effort`);
    assert.equal(state, row.state, `${key}: status`);
    seen.add(key);
  }
  assert.deepEqual(
    [...seen].sort(),
    [...adapter.keys()].sort(),
    'skill copies every routine row once',
  );
});

// #776 Acceptance 4 (D-RET-7): the adapter routine, the delegate skill and the Codex delegation guide
// carry one researcher rule: claims {url, quote, checkedAt} and the shared quote-check CLI for the claims
// that move into evidence. The request risk is per host: the Claude read delegation is registered on its
// declared risk and records requestRisk (DA-025, which replaced the D-RET-8 medium cap); the Codex lane
// keeps its default impactRisk min(envelope risk, medium) (Codex unchanged).
test('the researcher rule is the same in the routine, the delegate skill and the Codex guide', () => {
  const routine =
    read('docs/development/agent-workflows/adapters/claude-code.md')
      .split('## Routine operation')[1]
      ?.split('## Recovery')[0] ?? '';
  const codex = read('docs/development/agent-workflows/adapters/codex-delegation.md');
  for (const [name, text] of [
    ['claude-code.md routine', routine],
    ['knu-delegate', skill('knu-delegate')],
    ['codex-delegation.md', codex],
  ]) {
    assert.ok(text.includes('scripts/agents/common/quote-check.mjs'), `${name}: quote-check CLI`);
    assert.match(text, /\{url, quote, checkedAt\}/u, `${name}: claim fields`);
  }
  for (const [name, text] of [
    ['claude-code.md routine', routine],
    ['knu-delegate', skill('knu-delegate')],
  ]) {
    assert.match(text, /`requestRisk`/u, `${name}: recorded request risk`);
    assert.doesNotMatch(text, /min\([^)\n]*, ?medium\)/u, `${name}: no medium cap`);
  }
  assert.match(codex, /min\([^)\n]*, ?medium\)/u, 'codex-delegation.md: medium default');
  assert.match(skill('knu-settle'), /`quoteCheck`/u);
  // A fact sourceRef starts with a letter or digit, so the delegate skill names the plan reference form.
  assert.ok(skill('knu-delegate').includes('plan:<Plan ID>/<절>'));
  assert.match(skill('knu-delegate'), /release --task <taskId> --not-dispatched/u);
});

test('the delegate researcher example passes prepare with its URL only in the prompt (D-RET-3)', (t) => {
  const blocks = [...skill('knu-delegate').matchAll(/```json\n([\s\S]*?)\n```/gu)].map((match) =>
    JSON.parse(match[1].replaceAll('${CLAUDE_SESSION_ID}', randomUUID())),
  );
  const example = blocks.find((block) => block.role === 'knu_researcher');
  assert.ok(example, 'knu-delegate needs a researcher example');
  const spec = { ...blocks[0], ...example };
  assert.equal(spec.reviewDisposition.required, false);
  assert.match(spec.prompt, /https:\/\//u);
  assert.match(spec.prompt, /\{url, quote, checkedAt\}/u);
  for (const fact of spec.facts) assert.doesNotMatch(fact.sourceRef, /\/\//u, fact.key);
  const f = fixture(t);
  writeFileSync(
    join(f.root, '.claude/agents/knu_researcher.md'),
    `---\nname: knu_researcher\ntools: Read, Grep, Glob, WebSearch, WebFetch\neffort: ${ROLE_EFFORT.knu_researcher}\n---\nOfficial sources.\n`,
  );
  writeFileSync(join(f.root, 'package.json'), '{ "packageManager": "pnpm@0.0.0" }\n');
  execFileSync('git', ['add', '.'], { cwd: f.root });
  const prepared = prepareClaudeNativeTask(spec, { root: realpathSync(f.root) });
  assert.equal(prepared.invocation.subagent_type, 'knu_researcher');
});

// Runner log friction (OSS-RL P2 RED 7): the skill says how to write exit lines so a repeated step cannot hide a
// failure, and when to install before the helper.
test('knu-review tells how to write exit lines and to install after a lockfile change (RL-P2 RED 7)', () => {
  const step = dispatchStep(1);
  for (const phrase of [
    '검색 exit 줄은 명령 이름을 붙여 적습니다(`rg exit=1`)',
    '줄 전체 `exit=` 줄은 묶음의 끝 exit에만 씁니다',
    '`repeated-step-exit-hidden`',
  ])
    assert.ok(step.includes(phrase), `runner log friction: step 1 ${phrase}`);
  const flat = skill('knu-review').replace(/\s+/gu, ' ');
  assert.ok(
    flat.includes('lockfile이 바뀐 직후에는 helper 전에 `pnpm install --frozen-lockfile`'),
    'runner log friction: install after a lockfile change',
  );
});

test('review documents tie a closure-outside script change to the dependency judgment', () => {
  const flat = (path) => read(path).replace(/\s+/gu, ' ');
  const adapter = flat('docs/development/agent-workflows/adapters/claude-same-host-review.md');
  // The identity check passes; whether the reviewer result holds is the dependency judgment's call.
  assert.ok(
    !adapter.includes('그런 도구를 고쳐도 reviewer 결과는 유효합니다'),
    'review adapter: older wording without a condition',
  );
  assert.ok(
    adapter.includes('그런 도구를 고쳐도 identity 대조는 통과합니다'),
    'review adapter: the identity check passes',
  );
  assert.match(
    adapter,
    /의존 집합 밖이면 유효하고, 의존 집합 안이거나 저장소 전체로 판정하는 리뷰면 `unattributable-change:<경로>`로 거부합니다/u,
    'review adapter: the dependency judgment decides the settlement',
  );
  const settle = flat('.claude/skills/knu-settle/SKILL.md');
  assert.ok(
    !settle.includes('기록만 남는 관측(결과는 유효)'),
    'settle skill: older heading without a condition',
  );
  assert.match(
    settle,
    /의존 집합 안이거나 저장소 전체로 판정하는 리뷰면 같은 변경이 `unattributable-change:<경로>`로/u,
    'settle skill: an outside change can still be unattributable',
  );
});

test('review documents state one rule for a changed input original and for ignored subject files', () => {
  const flat = (path) => read(path).replace(/\s+/gu, ' ');
  // The skills, the registry, the review adapter and the rejection guide give the same conditions.
  for (const path of [
    '.claude/skills/knu-review/SKILL.md',
    '.claude/skills/knu-settle/SKILL.md',
    'docs/development/agent-workflows/adapters/claude-native-registry.md',
    'docs/development/agent-workflows/adapters/claude-same-host-review.md',
    REJECTIONS,
  ]) {
    const text = flat(path);
    assert.ok(text.includes('path로 지목'), `${path}: refused when a call names the original`);
    assert.match(
      text,
      /[Pp]ath 없는 검색과 저장소 root 검색/u,
      `${path}: a wide search names none`,
    );
    for (const older of ['원본을 읽은 것이 관측되면', '고쳐도 거부되지 않습니다(기록만)'])
      assert.ok(!text.includes(older), `${path}: older wording "${older}"`);
  }
  // A later round treats an ignored subject file like a tracked one.
  for (const path of [
    '.claude/skills/knu-review/SKILL.md',
    'docs/development/agent-workflows/adapters/claude-same-host-review.md',
  ]) {
    const text = flat(path);
    assert.ok(
      text.includes('직전 회차 입력 manifest'),
      `${path}: ignored subject files in a delta`,
    );
    assert.ok(
      !text.includes('Ignored 증거의 변경은 범위를 넓히지 않고'),
      `${path}: older delta rule`,
    );
  }
});

// P6 ② RED 8 and Owner 2026-11-21 1.2·1.3: the settle skill states the disposition record rules: a finding is
// recorded fixed only after the fix and with its fixRef, the record subject is one change name for every round, later
// rounds need an origin, a rebase leaves earlier records as they are, same-type locations are fixed or named in the
// reason, every unjudged line takes one of five values by what the Parent found, and a Parent reviewer's record names
// the result file settle wrote instead of a saved response string.
test('the settle skill states the disposition record rules (P6 ② RED 8)', () => {
  const text = read('.claude/skills/knu-settle/SKILL.md').replace(/\s+/gu, ' ');
  for (const [pattern, label] of [
    [/재현되면 고친 뒤 `fixed`와 `fixRef`/u, 'fixed only after the fix, with its fixRef'],
    [/고치기 전에는 `fixed`를 쓰지 않습니다/u, 'no fixed before the fix'],
    [
      /처분 기록 `subject`는 회차와 무관한 변경 이름이고 같은 변경의 모든 회차가 같은 문자열을 씁니다/u,
      'one subject name for every round',
    ],
    [/2회차부터 finding마다 `origin`\(`fix-induced`·`previously-missed`·`re-raised`\)/u, 'origin'],
    [/rebase·squash로 SHA가 바뀌면 앞 회차 기록은 그대로 두고/u, 'rebase'],
    [
      /`sameTypeLocations`는 모두 고치거나 고치지 않은 위치를 그 finding 처분 `reason`에 남깁니다/u,
      'same type',
    ],
    [/`parent-checked`/u, 'parent-checked'],
    [/`pre-existing`/u, 'pre-existing'],
    [/`resultPath`/u, 'result file of settle'],
    [/출력 `response` 문자열을 그대로 저장하지 않습니다/u, 'no saved response string'],
  ])
    assert.match(text, pattern, label);
  assert.ok(!text.includes('재현되면 `fixed`이고'), 'older wording: fixed when reproduced');
});

// Review 1 m1-F6: a short SHA is no fixRef, so the settle skill names the 40-character commit SHA.
test('the settle skill names the 40-character commit SHA of a fixRef', () => {
  const text = read('.claude/skills/knu-settle/SKILL.md').replace(/\s+/gu, ' ');
  assert.match(text, /`fixRef`\(수정 commit의 40자 SHA/u, 'fixRef 40-character SHA');
});

// P6 ③ RED 4: the dispatch steps name the runner check arguments, the line-by-line judgment and sentence list, the
// hidden-path absence search with its positive control, the runner record limit, the runner environment, the subject
// consumers and the mutation sweep, under the names the Codex skill uses too (RED 6 compares the two).
test('knu-review dispatch steps carry the runner procedure under the shared names (P6 ③ RED 4)', () => {
  const section = dispatchSection(skill('knu-review'));
  assert.ok(section, 'knu-review has the Dispatch 전 단계 section');
  assert.deepEqual(
    section.bullets.map(({ name }) => name),
    DISPATCH_BULLETS,
    'lead bullets',
  );
  assert.deepEqual(
    section.steps.map(({ name }) => name),
    DISPATCH_STEPS,
    'numbered steps',
  );
  assert.deepEqual(missingDispatchPhrases(section), []);
  // review-run runs the runner check; a direct run is only for review run on its own.
  const runnerStep = section.steps.find(({ name }) => name === 'Runner 기록 검사').text;
  assert.ok(runnerStep.includes('`review-run`이 실행'), runnerStep);
  // P6 ③ review round 1 (m1-F2): review-run keeps a warning in its check output and registers, so the step says where
  // the warning is and to run the check before review-run to act on it.
  for (const phrase of ['checks/runner-log-check.json', '`warnings`', '`review-run` 전에'])
    assert.ok(runnerStep.includes(phrase), `runner check step: ${phrase}`);
  // The Parent subject step points its paths at the subject bullet.
  const flat = skill('knu-review').replace(/\s+/gu, ' ');
  assert.ok(flat.includes('그 소비자·실행 경로'), 'Parent subject paths name the consumers');
});

// OSS-RL P5 RED 1 (L9, D-OSS-37 ②): the unjudged-line disposition paragraphs check a claim together with the claims
// that use the same source and the claims of the same paragraph, and check the whole paragraph again before the next
// round when one is raised.
const L9_PHRASES = [
  '같은 원천(같은 명령 출력·같은 기록)을 쓰는 주장',
  '같은 문단의 주장을 한 번에 대조',
  '`raised`가 하나라도 있으면 그 문단 전체를 다시 대조한 뒤 다음 회차를 요청',
  '처분 근거 log',
];
test('the Claude settle skill and qa.md check unjudged lines by source and paragraph together (OSS-RL P5 RED 1)', () => {
  const flat = (path) => read(path).replace(/\s+/gu, ' ');
  const settle = flat('.claude/skills/knu-settle/SKILL.md');
  const unjudged = settle.slice(settle.indexOf('Result에 `unjudgedBehaviors`'));
  for (const phrase of L9_PHRASES)
    assert.ok(unjudged.includes(phrase), `knu-settle unjudged paragraph: ${phrase}`);
  const qa = flat('docs/development/agent-workflows/qa.md');
  const paragraph = qa.slice(qa.indexOf('Reviewer는 요구가 말하지 않은 동작을'));
  for (const phrase of L9_PHRASES)
    assert.ok(paragraph.includes(phrase), `qa.md unjudgedBehaviors paragraph: ${phrase}`);
  // The five disposition values stay as they are.
  for (const value of [
    '`parent-checked`',
    '`raised`',
    '`pre-existing`',
    '`out-of-scope`',
    '`follow-up`',
  ])
    assert.ok(unjudged.includes(value), `knu-settle keeps ${value}`);
});

// OSS-RL P5 goal 2 (h): a documents-only round sends the long code check records ahead with the previous result and
// confirms them during the review; the qa.md round rule and the Claude review skill say so instead of a full rerun.
test('qa.md and the Claude review skill carry a documents-only round ahead and confirm it before settling (OSS-RL P5)', () => {
  const flat = (path) => read(path).replace(/\s+/gu, ' ');
  const qa = flat('docs/development/agent-workflows/qa.md');
  assert.ok(
    !qa.includes('결정적 검사는 매 회차 전 범위로 실행'),
    'qa.md: older full-rerun sentence',
  );
  for (const phrase of [
    '결정적 검사는 매 회차 다시 실행합니다',
    '회차 diff가 문서(`.md`)뿐이면',
    '새·지운 `.md` 없음, 그 문서를 글자로 가진 `scripts/` 파일 없음',
    '리뷰 중 다시 돌려 정산 전에 결과 단위로 대조',
    '문서 검사·같은 유형 검색·evidence 재현은 매 회차 다시',
  ])
    assert.ok(qa.includes(phrase), `qa.md: ${phrase}`);
  const review = flat('.claude/skills/knu-review/SKILL.md');
  assert.ok(
    !review.includes('Runner 검사는 매 회차 전 범위로 다시 실행'),
    'knu-review: older full-rerun sentence',
  );
  assert.ok(review.includes('회차 diff가 문서(`.md`)뿐이면'), 'knu-review: documents-only round');
  const section = dispatchSection(skill('knu-review'));
  const environment = section.bullets.find(({ name }) => name === 'Runner 환경').text;
  for (const phrase of [
    '60초 이상',
    // The cost rule of the plan: changed `.md` files only (C4) that no tracked scripts file names (C5).
    '새로 만들거나 지운 `.md`가 없고',
    '바뀐 `.md`의 경로나 파일 이름을 가진 tracked `scripts/` 파일이 없는',
    '`carriedFrom`',
    '확인 실행을 1~2갈래로',
    '`<out-dir>/confirm/evidence.json`',
    'tracked 파일과 리뷰 read path를 바꾸지 않습니다',
    '`runner-read-trace.mjs`로 감쌉니다',
  ])
    assert.ok(environment.includes(phrase), `Runner 환경: ${phrase}`);
  const runnerStep = section.steps.find(({ name }) => name === 'Runner 기록 검사').text;
  for (const phrase of [
    '`<out-dir>/checks/carry-basis.json`',
    '`--carry-basis`',
    '`carried-record-mismatch`',
    '`carried-header-mismatch`',
    '`carry-round-diff-not-docs`',
    // C4 as the README states it: a non-`.md` path, a new or deleted `.md`, or no range record of that round.
    '`.md`가 아닌 경로·새 `.md`·지운 `.md`가 있거나 그 회차 범위 기록이 없으면 `carry-round-diff-not-docs`',
    '`carry-doc-referenced`',
    '`carry-path-unsupported`',
  ])
    assert.ok(runnerStep.includes(phrase), `Runner 기록 검사: ${phrase}`);
  // The record format names the optional field and where it is taken.
  assert.ok(
    review.includes('`carriedFrom`(그 log를 만든 회차 reviewId)'),
    'knu-review record format: carriedFrom',
  );
  // The Parent subject warning list names the two evidence warnings.
  for (const name of ['`evidence-claim-source-missing`', '`evidence-source-outside-read-paths`'])
    assert.ok(review.includes(name), `knu-review warnings: ${name}`);
});

test('the Claude settle skill names the confirm reasons of a carried round (OSS-RL P5)', () => {
  const settle = read('.claude/skills/knu-settle/SKILL.md').replace(/\s+/gu, ' ');
  const parent = settle.slice(
    settle.indexOf('- `parent-adjudication` reviewer'),
    settle.indexOf('- 기록만 남는 관측'),
  );
  for (const phrase of [
    '`(carried from <reviewId>)`',
    '`<reviewId>.carry.json`',
    '`carry-confirm-pending`이면 확인 실행이 끝난 뒤',
    '`carry-confirm-missing`·`carry-confirm-mismatch`면 결과를 쓰지 않고',
    '확인 기록을 이번 회차 record로 써서 같은 회차를 다시 리뷰',
  ])
    assert.ok(parent.includes(phrase), `parent-adjudication reviewer: ${phrase}`);
});

test('the review owner documents name the carry rules and the evidence source warnings (OSS-RL P5)', () => {
  const flat = (path) => read(path).replace(/\s+/gu, ' ');
  const adapter = flat('docs/development/agent-workflows/adapters/claude-same-host-review.md');
  for (const phrase of [
    '`carriedFrom`',
    '`--carry-basis`',
    '`carry-confirm-mismatch`',
    '`evidence-claim-source-missing`',
    '`evidence-source-outside-read-paths`',
    // Review round 1: the carried outputs are bound by digest (m1-F1) and the token rule takes Korean particles (m1-F2).
    '이어 쓴 출력을 carry 기록의 digest와 다시 재고',
    '수 바로 뒤의 한글 조사·낱말은 token을 막지 않고',
  ])
    assert.ok(adapter.includes(phrase), `claude-same-host-review.md: ${phrase}`);
  const criteria = flat('docs/development/agent-workflows/review-criteria/README.md');
  for (const phrase of [
    '`carriedFrom`',
    '`--carry-basis`',
    '`--confirm`',
    '`runner-read-trace.mjs`',
    // C4 also when the producing round left no scope record (review round 1 m2-F5).
    '그 회차의 범위 기록이 없어(basis에 회차 diff가 없음)',
  ])
    assert.ok(criteria.includes(phrase), `review criteria README: ${phrase}`);
  const tooling = flat(
    'docs/development/agent-workflows/review-criteria/agent-workflow-tooling.md',
  );
  const w5 = tooling.slice(tooling.indexOf('### W5.'), tooling.indexOf('### W6.'));
  assert.ok(w5.includes('`carriedFrom`'), 'W5 names the carried record exception');
  assert.ok(
    w5.includes('결과 단위(exit·조각·test 결과 줄)로만 판정 근거에 쓴다'),
    'W5: a carried record is judged by its result unit only',
  );
  // Owner 3.1: the question, the defect patterns, the guideline and the avoid cell each hold the exception, so no
  // cell reads a carried record as a defect (review round 1 m2-F2).
  const toolingText = read(
    'docs/development/agent-workflows/review-criteria/agent-workflow-tooling.md',
  );
  const w5Lines = toolingText
    .slice(toolingText.indexOf('### W5.'), toolingText.indexOf('### W6.'))
    .split('\n');
  for (const cell of ['- 질문:', '- 결함 패턴:', '- 지침:', '- 피함:'])
    assert.ok(
      w5Lines.find((line) => line.startsWith(cell))?.includes('`runner-log-check`가 받'),
      `W5 ${cell} holds the carried record exception`,
    );
  const rejections = flat(REJECTIONS);
  for (const reason of [
    'carry-path-unsupported',
    'carry-basis-missing',
    'carried-record-mismatch',
    'carried-header-mismatch',
    'carry-round-diff-not-docs',
    'carry-doc-referenced',
    'carry-confirm-pending',
    'carry-confirm-missing',
    'carry-confirm-mismatch',
  ])
    assert.ok(rejections.includes(`\`${reason}`), `rejection guide: ${reason}`);
});
