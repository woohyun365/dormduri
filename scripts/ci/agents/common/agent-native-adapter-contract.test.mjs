import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../../..');
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

// Each role fixes its effort so a child never inherits the Parent session's effort.
const ROLE_EFFORT = {
  knu_explorer: 'high',
  knu_researcher: 'high',
  knu_executor: 'high',
  knu_executor_xhigh: 'xhigh',
  knu_reviewer: 'xhigh',
};
const roleSource = (role) => read(`.claude/agents/${role}.md`);
const roleBody = (source) => source.replace(/^---\n[\s\S]*?\n---\n/u, '');

test('five project Claude agents declare bounded native tools and a fixed effort', () => {
  const readOnly = new Set(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch']);

  for (const [role, effort] of Object.entries(ROLE_EFFORT)) {
    const path = `.claude/agents/${role}.md`;
    const source = roleSource(role);
    const frontmatter = /^---\n([\s\S]*?)\n---/u.exec(source)?.[1];
    assert.ok(frontmatter, `${path}: missing YAML frontmatter`);
    assert.deepEqual(
      frontmatter.split('\n').map((line) => line.slice(0, line.indexOf(':'))),
      ['name', 'description', 'tools', 'effort'],
      `${path}: frontmatter keys`,
    );
    assert.match(frontmatter, new RegExp(`^name: ${role}$`, 'mu'));
    assert.match(frontmatter, /^description: .+$/mu);
    assert.match(frontmatter, new RegExp(`^effort: ${effort}$`, 'mu'), `${path}: effort`);

    const tools = /^tools: (.+)$/mu
      .exec(frontmatter)?.[1]
      ?.split(',')
      .map((item) => item.trim());
    assert.ok(tools?.length, `${path}: explicit tools required`);
    assert.equal(new Set(tools).size, tools.length, `${path}: duplicate tool`);
    assert.ok(!tools.includes('Agent'), `${path}: child re-delegation is not allowed`);
    assert.doesNotMatch(frontmatter, /^permissionMode: bypassPermissions$/mu);
    if (role.startsWith('knu_executor')) {
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
  assert.equal(
    roleBody(roleSource('knu_executor_xhigh')),
    roleBody(roleSource('knu_executor')),
    'the xhigh variant differs from knu_executor only in its frontmatter',
  );
});

// Official subagent frontmatter fields as of the 2026-10-01 Claude Code subagent docs. This list is a
// pinned copy, not a live read: a new official field fails here until the disposition table covers it.
const OFFICIAL_SUBAGENT_FIELDS = [
  'name',
  'description',
  'tools',
  'disallowedTools',
  'model',
  'permissionMode',
  'maxTurns',
  'skills',
  'mcpServers',
  'hooks',
  'memory',
  'background',
  'omitClaudeMd',
  'effort',
  'isolation',
  'color',
  'initialPrompt',
  'experimental',
];

test('effort documents cover rejection reasons, five roles, field dispositions and Parent judgment', () => {
  const adapters = 'docs/development/agent-workflows/adapters/';
  const recovery = read(`${adapters}claude-code.md`).split('## Recovery')[1] ?? '';
  for (const stale of ['kind `extract`를 받지 않습니다', '현재 KNU 역할에는 effort 필드가 없어'])
    assert.ok(!recovery.includes(stale), `stale Recovery fact: ${stale}`);

  const rejections = read(
    'docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md',
  );
  for (const reason of [
    'effort-tier',
    'invalid-role-effort',
    'effort-transcript-pending',
    'effort-transcript-foreign',
    'effort-unobserved',
    'effort-mismatch',
  ])
    assert.ok(rejections.includes(`\`${reason}\``), `rejection reason: ${reason}`);

  const registry = read(`${adapters}claude-native-registry.md`);
  for (const role of Object.keys(ROLE_EFFORT))
    assert.match(registry, new RegExp(`^\\| \`${role}\` +\\|`, 'mu'), `registry role row: ${role}`);
  assert.ok(!registry.includes('네 `.claude/agents/knu_*.md`'), 'registry still counts four roles');

  for (const doc of [`${adapters}claude-same-host-review.md`, rejections]) {
    const text = doc.startsWith(adapters) ? read(doc) : doc;
    assert.ok(
      text.includes('`observationErrors`'),
      'Parent judgment reads settle observation errors',
    );
    assert.ok(
      !text.includes('`completion.json` 관측(valid'),
      'Parent judgment must not use completion valid',
    );
  }

  const profiles = read(`${adapters}claude-model-profiles.md`);
  const table = profiles.split('### Frontmatter 필드 처분')[1]?.split('\n#')[0] ?? '';
  const fields = [...table.matchAll(/^\| `([A-Za-z]+)` +\|/gmu)].map((match) => match[1]);
  assert.deepEqual([...fields].sort(), [...OFFICIAL_SUBAGENT_FIELDS].sort(), 'field dispositions');
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
  const claude = read('docs/development/agent-workflows/adapters/claude-qualification.md');
  for (const source of [adapters, claude]) {
    assert.match(source, /repository-prepared/u);
    assert.match(source, /runtime-qualified/u);
  }
  assert.match(claude, /separately authorized/u);
});

test('Claude troubleshooting is linked both ways from the adapter steps and the index', () => {
  const index = read('docs/development/troubleshooting/README.md');
  for (const [name, step] of [
    ['claude-native-hook-failure-and-completion-refusal', 'claude-native-registry.md'],
    ['claude-native-completion-observation-missing', 'claude-native-registry.md'],
    ['claude-native-registration-and-review-rejections', 'claude-native-registry.md'],
    ['claude-live-session-from-claude-session', 'claude-qualification.md'],
    ['claude-auto-classifier-no-verdict', 'claude-native-registry.md'],
  ]) {
    const guide = read(`docs/development/agent-workflows/adapters/${step}`);
    const source = read(`docs/development/troubleshooting/tooling/${name}.md`);
    for (const heading of ['증상', '원인', '해결', '검증', '참고'])
      assert.ok(source.includes(`## ${heading}`), `${name}: ${heading}`);
    assert.match(source, /agent-workflows\/adapters\/claude-code\.md/u, name);
    assert.ok(guide.includes(`troubleshooting/tooling/${name}.md`), name);
    assert.ok(index.includes(`./tooling/${name}.md`), name);
  }
  // Rejections must not push the operator back to transcription or exit inversion.
  const rejections = read(
    'docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md',
  );
  for (const rule of [
    '수정 전 실패(RED)는 exit를 뒤집지 말고',
    '1~255의 `expectedExit`',
    'hard link는 탐지하지 않으므로 native 기록을 연결해 두지 않습니다',
    '응답을 Parent가 파일로 옮겨 `--parent-subject`로\n  우회하지 않습니다',
    'a read-only subject is reviewed from its bound response',
    'a RED record passes only at its declared expected exit',
  ])
    assert.ok(rejections.includes(rule), rule);
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
  // Each pinned boundary is read from the one document that holds it after the adapter split.
  const boundaries = {
    'claude-code.md': [
      '`claude:workflow --native`는 완전한 task 입력 없이 상태만 진단하는 명령이므로 실행하지 않습니다',
      '`dispatchAuthorized:false`는 host 권한을 발급하지 않는다는 뜻이며',
      '`runtimeQualified:false`도 해당 실행의 전체 검증을 대신하지 않습니다',
      '.plans/finished/',
      '.plans/cancelled/',
      'Native Plan Mode',
      'OMC 없이도',
      '## Routine operation',
      '같은 turn에서 정산을 반복 시도하지 않습니다',
      'Q 행은 live 증거가 생길 때까지 routine으로 쓰지 않습니다',
      '아래 관측 ID 밖의 exact 모델로 해석되는\n조합은 관측 전까지 routine이 아닙니다',
      '## Recovery',
      '**한 번만** 허용하며 새 task로 다시 등록합니다',
      'Quota·permission·QA 문제는 모델·effort 변경으로 우회하지 않습니다',
      '## Parent 운영과 quality stop',
      '같은 subject의 연속 non-PASS가 확인되면 **quality stop**입니다',
      '## OMC 공존과 skill routing',
      '**현재 요청 > `AGENTS.md`·`CLAUDE.md` > 이 adapter > OMC·Home 권장**',
      '위임한 저장소 쓰기와 필수 독립 QA는 **등록·정산된 KNU 역할**만 충족합니다',
      '정산은 `complete`(또는 `settle --judgment`)와\n  Parent 작성 변경의 `settlement:"parent-adjudication"` 판정을 포함합니다',
      '이 규칙은 runtime 차단이 아니라 운영 규칙입니다',
      '| OMC 요청·skill',
      '재시도는 실패한 1차 task에 결속합니다',
      '공통 원칙의 자동 사다리가 아닙니다',
      '등록된 재시도가 실행되지 못해도 재시도 기회는 쓴 것입니다',
      '결속 없는 같은 사실 재등록의 상한은 Lead 운영 규칙입니다',
      '결과는 그 조합의 증거로 기록할 뿐 routine 채택으로 보지 않습니다',
      '같은 alias가 현재 CLI 버전에서 관측된 ID',
      '조건을 맞추려고 task 사실을 바꾸지 않으며',
      'Claude Parent 기본값은 **Opus 5.5 high**입니다',
      'Host는 이 규칙을 강제하지 않습니다(advisory)',
    ],
    'claude-native-registry.md': [
      '일반 interactive auto 세션',
      'PreToolUse',
      'PostToolUse',
      '실행 자체의 fail-closed를 보장하지 않습니다',
      'semantic PASS로 자동 승격하지 않습니다',
      'boolean·receipt·JSON만으로 수행 사실을 인증하지 않습니다',
    ],
    'claude-model-profiles.md': [
      '일반 auto의\ngate로 사용하지 않습니다',
      '문서화된 ask 동작과 다르므로',
      '완료 판정 거부입니다',
      '`resolvedModel`은 시작 또는 background 전환 시점 모델이고',
      '`modelsUsed`는 변경 관측입니다',
      'Parent modelUsage나 응답 문장을 child model 입증으로 사용하지 않습니다',
      '같은 tool ID라도 다른 parent/session/run/source/config/binding의 record를 합치지 않습니다',
      '임의 JSON receipt를 actual host observation으로 취급하지 않습니다',
    ],
    'claude-same-host-review.md': [
      'Exit를 뒤집는 명령으로 기록하지 않습니다',
      '1~255의 `expectedExit`',
      '기대·실제 exit는 packet `tests`와 결과 template에 함께 보입니다',
      'Parent가 응답을 옮겨 적는 parent-adjudication으로 우회하지 않습니다',
      'writer subject면 응답 artifact를 포함할 수 없습니다',
      '디렉터리 안의 symlink는 검사하지 않고 working tree 변경으로 snapshot에 드러나며, hard link는 탐지 대상이 아닙니다',
    ],
  };
  for (const [file, pinned] of Object.entries(boundaries)) {
    const source = read(`docs/development/agent-workflows/adapters/${file}`);
    for (const boundary of pinned) assert.ok(source.includes(boundary), `${file}: ${boundary}`);
  }
  const routine = guide.slice(guide.indexOf('## Routine operation'), guide.indexOf('## Recovery'));
  const header = routine.split('\n').find((line) => line.startsWith('| 역할'));
  assert.deepEqual(
    header?.split('|').map((cell) => cell.trim()),
    ['', '역할', 'Profile', 'Alias', 'Effort', '관측된 모델 ID', '작업', '상태', ''],
    'routine table columns',
  );
  // Every role row keeps the backticked role prefix, so a reformatted row cannot drop out of this check.
  const rows = routine.split('\n').filter((line) => /^\|\s*`?knu_/u.test(line));
  for (const row of rows) assert.match(row, /^\| `knu_[a-z_]+` +\|/u, row);
  assert.deepEqual(
    rows.map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      return cells.slice(1, 8).join(' ');
    }),
    [
      '`knu_explorer` `bounded-extraction` `haiku` —(미지원) `claude-haiku-4-5-20251001` 고정 입력 추출 미사용(Haiku 5.5 migration plan 대기)',
      '`knu_explorer` `bounded-standard` `sonnet` high `claude-sonnet-5-5`(2.1.286) 고정 입력 추출 관측',
      '`knu_executor` `bounded-standard` `sonnet` high `claude-sonnet-5-5`(2.1.284) bounded 구현·검증 관측',
      '`knu_researcher` `bounded-standard` `sonnet` high `claude-sonnet-5-5`(2.1.286) 공식 근거 읽기 관측',
      '`knu_reviewer` `complex-critical` `opus` xhigh `claude-opus-5-5`(2.1.286) 독립 source review 관측',
      '`knu_explorer` `bounded-standard` `sonnet` high `claude-sonnet-5-5`(2.1.286) repository 읽기 조사 관측',
      '`knu_executor` `complex-critical` `opus` high `claude-opus-5-5`(2.1.286) 복잡한 구현 관측',
      '`knu_executor_xhigh` `complex-critical` `opus` xhigh `claude-opus-5-5`(2.1.286) 고위험 구현 관측',
    ],
    'routine table keeps only live-observed rows adopted by the Owner',
  );
  for (const row of rows) {
    const cells = row.split('|').map((cell) => cell.trim());
    const role = cells[1].replaceAll('`', '');
    if (cells[3] !== '`haiku`') assert.equal(cells[4], ROLE_EFFORT[role], `${role}: effort column`);
  }
  assert.ok(
    routine.replace(/\s+/gu, ' ').includes('Effort 열은 역할 파일의 설정값이고'),
    'effort column is the configured value, not an observation',
  );
  for (const role of Object.keys(ROLE_EFFORT)) {
    const source = roleSource(role);
    assert.doesNotMatch(source, /^model:/mu, 'no unauthorized permanent model pin');
    assert.ok(source.includes('다른 agent'), 'child offload boundary remains explicit');
  }
  assert.ok(
    read('.claude/agents/knu_researcher.md').includes(
      '원문 문장을 URL과 함께 인용할 때만 사실로 씁니다',
    ) &&
      read('.claude/agents/knu_researcher.md').includes(
        '표시명·예시·다른 식별자에서 유도한 값은 추론으로 표시하고 확인하지 못한 식별자는 gap으로 남깁니다',
      ),
    'researcher states identifiers as fact only with a quoted source',
  );
});

test('Claude Recovery summarizes the bound ladder and drops the rules it replaced', () => {
  const guide = read('docs/development/agent-workflows/adapters/claude-code.md');
  const recovery = guide.slice(
    guide.indexOf('## Recovery'),
    guide.indexOf('\n## ', guide.indexOf('## Recovery') + 1),
  );
  for (const replaced of [
    '올린 profile도 자기 조건을 그대로 만족해야',
    '중도에 멈췄다면 effort를 올립니다',
    'Context·acceptance가 부족했다면',
  ])
    assert.ok(!recovery.includes(replaced), `replaced Recovery rule remains: ${replaced}`);
  for (const link of ['./claude-model-profiles.md#', './claude-native-registry.md#'])
    assert.ok(recovery.includes(link), `Recovery links its detail: ${link}`);
  assert.ok(recovery.includes('../orchestration.md#recovery-ceiling'));
  assert.match(
    read('docs/development/agent-workflows/adapters/claude-model-profiles.md'),
    /^#{2,4} [^\n]*상향 사다리/mu,
  );
});
