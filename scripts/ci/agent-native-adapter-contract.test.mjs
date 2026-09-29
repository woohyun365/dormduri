import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function isIgnored(path) {
  const result = spawnSync('git', ['check-ignore', '--no-index', '-q', path], { cwd: root });
  assert.ok([0, 1].includes(result.status), result.stderr?.toString());
  return result.status === 0;
}

test('Claude entry imports the shared repository contract without copying it', () => {
  const source = read('CLAUDE.md');

  assert.match(source, /^@AGENTS\.md\s*$/mu);
  assert.ok(source.split('\n').length <= 35, 'Claude entry must remain a small adapter');
  assert.equal(isIgnored('CLAUDE.md'), false);
  assert.match(source, /docs\/development\/agent-workflows\/adapters\/claude-code\.md/u);
});

test('four project Claude agents declare bounded native tools', () => {
  const readOnly = new Set(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch']);

  for (const role of ['explorer', 'researcher', 'executor', 'reviewer']) {
    const path = `.claude/agents/knu_${role}.md`;
    const source = read(path);
    const frontmatter = /^---\n([\s\S]*?)\n---/u.exec(source)?.[1];
    assert.ok(frontmatter, `${path}: missing YAML frontmatter`);
    assert.match(frontmatter, new RegExp(`^name: knu_${role}$`, 'mu'));
    assert.match(frontmatter, /^description: .+$/mu);

    const tools = /^tools: (.+)$/mu
      .exec(frontmatter)?.[1]
      ?.split(',')
      .map((item) => item.trim());
    assert.ok(tools?.length, `${path}: explicit tools required`);
    assert.equal(new Set(tools).size, tools.length, `${path}: duplicate tool`);
    assert.ok(!tools.includes('Agent'), `${path}: child re-delegation is not allowed`);
    assert.doesNotMatch(frontmatter, /^permissionMode: bypassPermissions$/mu);
    if (role === 'executor') {
      assert.ok(tools.includes('Edit') && tools.includes('Bash'));
    } else {
      assert.ok(
        tools.every((tool) => readOnly.has(tool)),
        `${path}: read-only role has write-capable tool`,
      );
    }
    assert.equal(isIgnored(path), false, `${path}: project role must be portable`);
    assert.match(source, /docs\/development\/agent-workflows\//u);
  }
});

test('Claude private runtime state stays ignored while both host adapters have entry points', () => {
  for (const path of [
    '.claude/settings.local.json',
    '.claude/projects/example/session.json',
    '.claude/agents/private-draft.md',
    '.omc/session.json',
    '.omx/state/example.json',
  ]) {
    assert.equal(isIgnored(path), true, `${path}: private runtime data must remain ignored`);
  }

  for (const path of [
    'docs/development/agent-workflows/adapters/README.md',
    'docs/development/agent-workflows/adapters/codex.md',
    'docs/development/agent-workflows/adapters/claude-code.md',
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, `${path}: missing adapter entry`);
  }

  assert.match(read('docs/development/agent-workflows/orchestration.md'), /Codex.*adapter/u);
  assert.match(
    read('docs/development/agent-workflows/agentic-architecture-decisions.md'),
    /Codex.*cohort/u,
  );
});

test('Taste and Redesign remain Codex-only and are not Claude project skills', () => {
  for (const skill of ['design-taste-frontend', 'redesign-existing-projects']) {
    for (const file of ['SKILL.md', 'LICENSE', 'SOURCE.json']) {
      const path = `.claude/skills/${skill}/${file}`;
      assert.equal(existsSync(resolve(root, path)), false, `${path}: skill must not be ported`);
      assert.equal(isIgnored(path), true, `${path}: skill must not be allowlisted`);
    }
  }

  const claude = read('docs/development/agent-workflows/adapters/claude-code.md');
  const codex = read('docs/development/agent-workflows/adapters/codex.md');
  const design = read(
    'docs/development/agent-workflows/visual-design/design-task-orchestration.md',
  );
  const codexOnlySkills =
    /Taste \(`design-taste-frontend`\)와 Redesign \(`redesign-existing-projects`\)은 \*\*Codex-only\*\*/u;
  assert.match(claude, codexOnlySkills);
  assert.match(
    codex,
    /Taste \(`design-taste-frontend`\)와 Redesign \(`redesign-existing-projects`\)은 \*\*Codex-only\*\*/u,
  );
  assert.match(design, /`design-taste-frontend`.*`redesign-existing-projects`.*Codex 전용/su);
});

test('repository preparation and future live qualification are distinct completion claims', () => {
  const adapters = read('docs/development/agent-workflows/adapters/README.md');
  const claude = read('docs/development/agent-workflows/adapters/claude-code.md');
  for (const source of [adapters, claude]) {
    assert.match(source, /repository-prepared/u);
    assert.match(source, /runtime-qualified/u);
  }
  assert.match(claude, /separately authorized/u);
});

test('Claude troubleshooting is linked both ways from the adapter steps and the index', () => {
  const guide = read('docs/development/agent-workflows/adapters/claude-code.md');
  const index = read('docs/development/troubleshooting/README.md');
  for (const name of [
    'claude-native-hook-failure-and-completion-refusal',
    'claude-native-completion-observation-missing',
    'claude-native-registration-and-review-rejections',
    'claude-live-session-from-claude-session',
    'claude-auto-classifier-no-verdict',
  ]) {
    const source = read(`docs/development/troubleshooting/tooling/${name}.md`);
    for (const heading of ['증상', '원인', '해결', '검증', '참고'])
      assert.ok(source.includes(`## ${heading}`), `${name}: ${heading}`);
    assert.match(source, /agent-workflows\/adapters\/claude-code\.md/u, name);
    assert.ok(guide.includes(`troubleshooting/tooling/${name}.md`), name);
    assert.ok(index.includes(`./tooling/${name}.md`), name);
  }
  // Hook failure stays a completion refusal, never an execution gate.
  const hook = read(
    'docs/development/troubleshooting/tooling/claude-native-hook-failure-and-completion-refusal.md',
  );
  assert.match(hook, /완료 판정 거부/u);
  assert.match(
    hook,
    /정적 테스트는 실제 host가\s*hook 장애를 어떻게 처리하는지 증명하지 않습니다/u,
  );
  assert.doesNotMatch(hook, /fail-closed(를|로) 보장/u);
  // Documented classifier skips are not an observed guarantee; keep the dated observation and the gap.
  const noVerdict = read(
    'docs/development/troubleshooting/tooling/claude-auto-classifier-no-verdict.md',
  );
  assert.doesNotMatch(noVerdict, /작업 디렉터리 편집은\s*판정을 거치지 않습니다/u);
  assert.doesNotMatch(
    noVerdict,
    /(Edit|전용 도구)[^.]*?판정(을\s*거치지\s*않|을\s*건너(뛰|뜁)|의\s*대상이\s*아니|에서\s*제외)/u,
  );
  assert.match(noVerdict, /관측\(\d{4}-\d{2}-\d{2}, CLI [\d.]+\)/u);
  assert.match(noVerdict, /원인[^\n]*확인하지 못했습니다/u);
  assert.match(noVerdict, /판정 누락을 없애지는 못합니다/u);
  assert.match(noVerdict, /부분 명령마다/u);
  assert.match(noVerdict, /claude auto-mode config/u);
  // A prefix allow also passes exec/write flags; pair them with ask and keep the boundary caveat.
  // Broad prefix rules appear only as the subject of the flag warning, never as a plain allow example.
  assert.doesNotMatch(noVerdict, /`Bash\((rg|git diff|git fetch) \*\)`(?!는)/u);
  assert.match(noVerdict, /prefix allow는 뒤에 붙는 flag를 가리지 않습니다/u);
  assert.match(noVerdict, /flag를\s*`permissions\.ask`\s*규칙으로 짝짓/u);
  assert.match(
    noVerdict,
    /`Bash\(rg --pre \*\)`, `Bash\(rg --pre=\*\)`, `Bash\(rg \* --pre \*\)`, `Bash\(rg \* --pre=\*\)`/u,
  );
  assert.match(noVerdict, /관측\(\d{4}-\d{2}-\d{2}, git [\d.]+\):/u);
  assert.match(
    noVerdict,
    /관측\(\d{4}-\d{2}-\d{2}, CLI [\d.]+\):\s*auto 세션에서 Bash `ask` 규칙에 맞는 명령은\s*확인 창을 띄웠고,\s*`deny` 규칙에 맞는 명령은\s*확인 창 없이\s*차단/u,
  );
  assert.match(noVerdict, /`git diff`·`git log`·`git show`는 받지 않았습니다/u);
  assert.match(noVerdict, /보안 경계가 아닙니다/u);
  assert.match(noVerdict, /판정 누락 노출이 늘어납니다/u);
  assert.match(noVerdict, /classifyAllShell: true`는 Bash·PowerShell allow 규칙/u);
  assert.match(noVerdict, /critical path[^\n]*`rm`·`rmdir`/u);
  assert.match(noVerdict, /직접 쓴 `environment` 배열에는\s*`"\$defaults"`가 들어 있습니다/u);
  for (const personal of [/\/Users\//u, /\.claude\/jobs/u, /\.plans\//u, /Phase \d/u]) {
    assert.doesNotMatch(noVerdict, personal);
  }
});

test('Claude entry documents actual host commands and keeps native/lifecycle evidence distinct', () => {
  const guide = read('docs/development/agent-workflows/adapters/claude-code.md');
  const entry = read('CLAUDE.md');
  const manifest = JSON.parse(read('package.json'));
  for (const [command, file] of [
    ['claude:preflight', 'session-preflight'],
    ['claude:workflow', 'workflow-entry'],
    ['claude:native', 'native-session'],
  ]) {
    assert.ok(manifest.scripts[command].includes(`scripts/agents/claude/${file}.mjs`));
    assert.ok(existsSync(resolve(root, `scripts/agents/claude/${file}.mjs`)));
    assert.ok(guide.includes(`pnpm ${command}`));
    assert.ok(entry.includes(`pnpm ${command}`));
  }
  for (const boundary of [
    '`claude:workflow --native`는 완전한 task 입력 없이 상태만 진단하는 명령이므로 실행하지 않습니다',
    '`dispatchAuthorized:false`는 host 권한을 발급하지 않는다는 뜻이며',
    '`runtimeQualified:false`도 해당 실행의 전체 검증을 대신하지 않습니다',
    '.plans/finished/',
    '.plans/cancelled/',
    'Native Plan Mode',
    'OMC 없이도',
    '일반 interactive auto 세션',
    'PreToolUse',
    'PostToolUse',
    '실행 자체의 fail-closed를 보장하지 않습니다',
    '일반 auto의\ngate로 사용하지 않습니다',
    '문서화된 ask 동작과 다르므로',
    '완료 판정 거부입니다',
    'semantic PASS로 자동 승격하지 않습니다',
    'boolean·receipt·JSON만으로 수행 사실을 인증하지 않습니다',
    '`resolvedModel`은 시작 또는 background 전환 시점 모델이고',
    '`modelsUsed`는 변경 관측입니다',
    'Parent modelUsage나 응답 문장을 child model 입증으로 사용하지 않습니다',
    'record를 합치지 않습니다',
    '임의 JSON receipt를 actual host observation으로 취급하지 않습니다',
  ]) {
    assert.ok(guide.includes(boundary), boundary);
  }
  for (const role of ['explorer', 'researcher', 'executor', 'reviewer']) {
    const source = read(`.claude/agents/knu_${role}.md`);
    assert.doesNotMatch(source, /^model:/mu, 'no unauthorized permanent model pin');
    assert.ok(source.includes('다른 agent'), 'child offload boundary remains explicit');
  }
});
