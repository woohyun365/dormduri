import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  ALLOWED_CHILD_MODELS,
  BASELINE_CHILD_MODEL,
} from '../../../agents/codex/model-profiles.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const UNLISTED_MODEL = 'gpt-x-unlisted';
const gitignorePath = resolve(repoRoot, '.gitignore');
const cases = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'scripts/ci/agents/codex/fixtures/project-codex-tracking-cases.json'),
    'utf8',
  ),
);
const expectedPortablePaths = [
  '.codex/config.toml',
  '.codex/agents/knu_explorer.toml',
  '.codex/agents/knu_researcher.toml',
  '.codex/agents/knu_reviewer.toml',
  '.codex/agents/knu_executor.toml',
];
const expectedProjectConfig = `[agents]
enabled = true
default_subagent_model = "${BASELINE_CHILD_MODEL}"
default_subagent_reasoning_effort = "high"
max_concurrent_threads_per_session = 6
`;
const readOnlyBoundary = /파일 수정, [^.]*하지 않습니다\./u;
const expectedRoles = [
  {
    file: 'knu_executor.toml',
    name: 'knu_executor',
    sandboxMode: 'workspace-write',
    model: null,
    boundaries: [
      /명시된 writeOwnership 안에서 구현합니다\./u,
      /writeOwnership 밖 편집, [^.]*하지 않습니다\./u,
      /범위·공유 파일·migration·파괴적 변경이 충돌하거나, ownership이 겹치거나, 권한이 없거나, 요청 경계가 크게 바뀌면 멈추고 Parent에게 돌려줍니다\./u,
    ],
    handoff: ['changed files', 'rollback note'],
  },
  {
    file: 'knu_explorer.toml',
    name: 'knu_explorer',
    sandboxMode: 'read-only',
    model: null,
    boundaries: [
      /파일·symbol 관계를 repository 기준 경로로 정확히 보고합니다\./u,
      readOnlyBoundary,
      /외부 조사·구현·범위 변경이 필요하면 멈추고 Parent에게 돌려줍니다\./u,
    ],
    handoff: [],
  },
  {
    file: 'knu_researcher.toml',
    name: 'knu_researcher',
    sandboxMode: 'read-only',
    model: null,
    boundaries: [
      readOnlyBoundary,
      /repository explorer·dependency 평가·구현 owner·사람\/provider 권한이 필요하면 멈추고 Parent에게 돌려줍니다\./u,
    ],
    handoff: ['source URLs'],
  },
  {
    file: 'knu_reviewer.toml',
    name: 'knu_reviewer',
    sandboxMode: 'read-only',
    model: BASELINE_CHILD_MODEL,
    boundaries: [
      readOnlyBoundary,
      /구현이나 미해결 owner 결정이 필요하면 멈추고 Parent에게 돌려줍니다\./u,
      /builder와 접촉하기 전에 frozen 요청과 source에서 finding을 먼저 도출/u,
    ],
    handoff: ['verdict', 'severity-ranked'],
  },
];
const allowedRoleKeys = ['description', 'developer_instructions', 'model', 'name', 'sandbox_mode'];
// Per-role UTF-8 budget for the slimmed prompt; shared procedure lives in the linked common documents.
const INSTRUCTION_BYTE_LIMIT = 1500;
const collaborationGuide = 'docs/development/agent-workflows/owner-lead-collaboration.md';
const qaGuide = 'docs/development/agent-workflows/qa.md';
const commonBoundaries = [
  /child agent를 만들거나 peer·shell\/subprocess·외부 model\/agent service로 작업을 offload하지 않습니다\./u,
  /통신은 Parent를 거칩니다\./u,
  /Peer에게는 Parent가 지정한 사실 확인만 docs\/development\/agent-workflows\/owner-lead-collaboration\.md에 따라 보냅니다\./u,
  /답이 없으면 기다리지 말고 질문을 Parent에게 돌려줍니다\./u,
  /QA는 docs\/development\/agent-workflows\/qa\.md를 따라 [^.]*self-PASS(?:하지 않|를 하지 않)[^.]*\./u,
];
const handoffTerms = [
  'facts',
  'inferences',
  'gaps',
  'confidence',
  'verification performed',
  'blocker',
  'safest next action',
];
// Collaboration tools differ between multi-agent engines; role prompts state boundaries, not tool calls.
const collaborationToolNames =
  /\b(?:spawn_agent|send_input|resume_agent|close_agent|wait_agent|send_message|followup_task|list_agents|interrupt_agent)\b/u;

function checkIgnore(path) {
  return spawnSync('git', ['check-ignore', '--no-index', '-q', path], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function readQuotedField(source, field) {
  return source.match(new RegExp(`^${field} = "([^"\\n]+)"$`, 'mu'))?.[1];
}

function topLevelKeys(source) {
  return [...source.matchAll(/^([A-Za-z0-9_.-]+)\s*=/gmu)]
    .map(([, key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

test('project Codex tracking uses a narrow config and top-level agent allowlist', () => {
  const gitignore = readFileSync(gitignorePath, 'utf8');

  assert.doesNotMatch(gitignore, /^\.codex\/$/mu);
  assert.match(gitignore, /^\.codex\/\*$/mu);
  assert.match(gitignore, /^!\.codex\/config\.toml$/mu);
  assert.match(gitignore, /^!\.codex\/agents\/$/mu);
  assert.match(gitignore, /^\.codex\/agents\/\*$/mu);
  assert.match(gitignore, /^!\.codex\/agents\/\*\.toml$/mu);
});

test('only portable project Codex candidates are trackable', () => {
  assert.deepEqual(cases.allowlisted, expectedPortablePaths);

  for (const path of cases.allowlisted) {
    const result = checkIgnore(path);
    assert.equal(result.status, 1, `${path} must be available for Git tracking`);
  }

  for (const path of cases.ignored) {
    const result = checkIgnore(path);
    assert.equal(result.status, 0, `${path} must remain ignored`);
  }
});

test('portable project Codex configuration is present', () => {
  const missing = cases.allowlisted.filter((path) => !existsSync(resolve(repoRoot, path)));

  assert.deepEqual(
    missing,
    [],
    'The reviewed project config and four agent files must exist before the project Codex contract can pass',
  );
});

test('project config owns child defaults without pinning parent or provider settings', () => {
  const source = readFileSync(resolve(repoRoot, '.codex/config.toml'), 'utf8');

  assert.equal(source, expectedProjectConfig);
  assert.doesNotMatch(
    source,
    /^(?:model|model_reasoning_effort|provider|auth|approval|profile|notify|mcp_servers)\s*=/mu,
  );
});

test('project roles inherit task models except the Astra reviewer with unchanged effort and sandboxes', () => {
  const agentDirectory = resolve(repoRoot, '.codex/agents');
  const files = readdirSync(agentDirectory)
    .filter((file) => file.endsWith('.toml'))
    .sort((left, right) => left.localeCompare(right));

  assert.deepEqual(
    files,
    expectedRoles.map(({ file }) => file),
  );

  for (const role of expectedRoles) {
    const source = readFileSync(resolve(agentDirectory, role.file), 'utf8');
    assertRoleContract(source, role);
  }
});

test('role prompts link the common contracts that own the procedures they leave out', () => {
  // Instruction presence only: actual communication/refusal behavior needs an observed pilot.
  const collaboration = readFileSync(resolve(repoRoot, collaborationGuide), 'utf8');
  assert.ok(existsSync(resolve(repoRoot, qaGuide)), qaGuide);
  // Peer conditions removed from role prompts must stay in the common contract the prompts link to.
  for (const owned of [
    /^## 통신: 기본은 Parent 경유, 예외는 지정된 사실 확인$/mu,
    /지정이 없으면 Parent 경유입니다\./u,
    /현재 host\/role\/도구 권한이 허용해야 합니다\./u,
    /완료·source\/scope 변경·Parent 철회로 지정은 만료됩니다\./u,
    /초기 단계에는 builder와 peer 대화하지 않습니다\./u,
    /\(\.\/qa\.md\)/u,
  ])
    assert.match(collaboration, owned, collaborationGuide);
});

function roleInstructions(source) {
  return source.match(/developer_instructions\s*=\s*"""([\s\S]*?)"""/u)?.[1].trim();
}

function assertRoleContract(source, role) {
  const instructions = roleInstructions(source);

  assert.deepEqual(
    topLevelKeys(source),
    role.model === null ? allowedRoleKeys.filter((key) => key !== 'model') : allowedRoleKeys,
    role.file,
  );
  assert.equal(readQuotedField(source, 'name'), role.name, role.file);
  assert.ok(readQuotedField(source, 'description')?.length > 20, role.file);
  assert.equal(readQuotedField(source, 'model'), role.model ?? undefined, role.file);
  assert.equal(readQuotedField(source, 'sandbox_mode'), role.sandboxMode, role.file);
  assert.ok(instructions?.length > 300, role.file);
  assert.doesNotMatch(
    instructions,
    collaborationToolNames,
    `${role.file}: collaboration tool name`,
  );
  assert.ok(
    Buffer.byteLength(instructions, 'utf8') <= INSTRUCTION_BYTE_LIMIT,
    `${role.file}: developer_instructions ${Buffer.byteLength(instructions, 'utf8')} > ${INSTRUCTION_BYTE_LIMIT} bytes`,
  );
  for (const boundary of [...commonBoundaries, ...role.boundaries])
    assert.match(instructions, boundary, `${role.file}: boundary ${boundary}`);
  const handoff = instructions.match(/handoff는 ([^.]+)을 담아 짧게 반환합니다\./u)?.[1];
  assert.ok(handoff, `${role.file}: handoff sentence`);
  for (const term of [...handoffTerms, ...role.handoff])
    assert.ok(handoff.includes(term), `${role.file}: handoff ${term}`);
  assert.doesNotMatch(source, /^model_reasoning_effort\s*=/mu, role.file);
  assert.doesNotMatch(source, /^skills\.config\s*=/mu, role.file);
  assert.doesNotMatch(source, /\/Users\//u, role.file);
}

test('role contract rejects execution repins, reviewer downgrade and permission or effort drift', () => {
  // File contract only, not a simulation of the native configuration resolver.
  for (const role of expectedRoles) {
    const source = readFileSync(resolve(repoRoot, '.codex/agents', role.file), 'utf8');
    const mutations = [
      source + '\nmodel_reasoning_effort = "low"\n',
      source.replace(`sandbox_mode = "${role.sandboxMode}"`, 'sandbox_mode = "danger-full-access"'),
      source.replace(`name = "${role.name}"`, 'name = "shadow_role"'),
    ];
    if (role.model === null) {
      mutations.push(
        source + `\nmodel = "${BASELINE_CHILD_MODEL}"\n`,
        source + `\nmodel = "${UNLISTED_MODEL}"\n`,
      );
    } else {
      mutations.push(
        source.replace(`model = "${role.model}"\n`, ''),
        source.replace(`model = "${role.model}"`, `model = "${UNLISTED_MODEL}"`),
      );
    }
    for (const mutated of mutations)
      assert.throws(() => assertRoleContract(mutated, role), assert.AssertionError);
  }
});

test('role contract rejects dropped or weakened boundaries, tool-name procedures and prompt regrowth', () => {
  for (const role of expectedRoles) {
    const source = readFileSync(resolve(repoRoot, '.codex/agents', role.file), 'utf8');
    const instructions = roleInstructions(source);
    const append = (text) => source.replace(instructions, `${instructions}\n${text}`);
    // [mutated source, expected failure reason]
    const mutations = [
      [append('진행 상황을 Parent에게 알립니다. '.repeat(20)), /bytes/u],
      [append('지정된 peer에게는 send_message로 연락합니다.'), /collaboration tool name/u],
      [
        source.replace(/self-PASS(를)? 하지 않으며|self-PASS하지 않으며/u, 'self-PASS하며'),
        /boundary/u,
      ],
    ];
    for (const boundary of [...commonBoundaries, ...role.boundaries]) {
      const sentence = instructions.match(boundary)?.[0];
      assert.ok(sentence, `${role.file}: ${boundary}`);
      mutations.push([source.replace(sentence, ''), /boundary/u]);
      // A prohibition that keeps its wording but loses the negation, or a stop rule reduced to a generic condition.
      if (sentence.endsWith('하지 않습니다.'))
        mutations.push([
          source.replace(sentence, sentence.replace(/하지 않습니다\.$/u, '할 수 있습니다.')),
          /boundary/u,
        ]);
      if (sentence.endsWith('면 멈추고 Parent에게 돌려줍니다.'))
        mutations.push([
          source.replace(sentence, '필요하면 멈추고 Parent에게 돌려줍니다.'),
          /boundary/u,
        ]);
    }
    for (const [mutated, reason] of mutations) {
      assert.notEqual(mutated, source, `${role.file}: mutation applied`);
      assert.throws(() => assertRoleContract(mutated, role), {
        name: 'AssertionError',
        message: reason,
      });
    }
  }
});

test('project Codex model values are bound to the runtime allowlist owner', () => {
  // Codex loads these files directly, so a test, not the runtime, keeps them inside the allowlist.
  const config = readFileSync(resolve(repoRoot, '.codex/config.toml'), 'utf8');
  assert.equal(readQuotedField(config, 'default_subagent_model'), BASELINE_CHILD_MODEL);
  for (const path of expectedPortablePaths) {
    const source = readFileSync(resolve(repoRoot, path), 'utf8');
    for (const [, value] of source.matchAll(/^(?:model|default_subagent_model) = "([^"\n]*)"$/gmu))
      assert.ok(ALLOWED_CHILD_MODELS.includes(value), `${path}: ${value}`);
  }
  const reviewer = readFileSync(resolve(repoRoot, '.codex/agents/knu_reviewer.toml'), 'utf8');
  assert.equal(readQuotedField(reviewer, 'model'), BASELINE_CHILD_MODEL);
});
