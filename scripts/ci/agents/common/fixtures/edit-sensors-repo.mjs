// Fixture repository for the edit-time sensor tests: a git repository with a binding `## 센서` table, a criteria
// document whose items point at the rows, and stub tools under node_modules/.bin. Workspace directories, tsconfig
// names and prerequisites come from the module table the test passes in, so this file names no product file.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const SESSION = '5b0c1e2a-3f4d-4a5b-8c6d-7e8f9a0b1c2d';
export const BINDING = 'docs/development/agent-workflows/domain/knu-binding.md';
export const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
// Words the stub tools look for in a file: a stub fails, or sleeps past a short limit, when its file has one.
export const UNFORMATTED = 'UNFORMATTED_MARK';
export const LINT_ERROR = 'LINT_ERROR_MARK';
export const TYPE_ERROR = 'TYPE_ERROR_MARK';
export const SLOW = 'SLOW_TOOL_MARK';
export const STUB_LOG = '.artifacts/stub-calls.log';

const MODULE_LINK = '[edit-sensors](../../../../scripts/agents/common/edit-sensors.mjs)';

export function sensorTable({ after = '직후 8초', end = '끝 30초' } = {}) {
  return [
    '## 센서',
    '',
    '| 키 | 대상 | 명령 | 실행 시점 | 지점과 상한 |',
    '| --- | --- | --- | --- | --- |',
    `| \`sensor.format\` | \`**/*\` | ${MODULE_LINK} | 편집, commit | ${after} |`,
    `| \`sensor.lint\` | \`apps/**\`, \`packages/**\` | ${MODULE_LINK} | 편집, CI | ${after} |`,
    `| \`sensor.typecheck\` | \`apps/**\`, \`packages/**\` | ${MODULE_LINK} | 편집, CI | ${end} |`,
    `| \`sensor.test-change\` | \`**/*.test.*\`, \`**/*.spec.*\` | ${MODULE_LINK} | 편집 | ${after}, ${end} |`,
    '| `sensor.ci-only` | `apps/**` | `pnpm lint` | CI | - |',
    '',
  ].join('\n');
}

function bindingText(table) {
  return [
    '# KNU domain binding',
    '',
    '| 키 | 값 |',
    '| --- | --- |',
    '| `repo-structure.review-swe` | `apps/**`, `packages/**` |',
    '| `repo-structure.fixture-web` | `apps/web/**` |',
    '',
    table,
  ].join('\n');
}

const item = (id, title, { question, guidance, sensor, trigger }) =>
  [
    `### ${id}. ${title}`,
    '',
    `- 질문: ${question}`,
    '- 기본 severity: `medium`',
    '- 적용 조건: 예시 변경',
    '- 결함 패턴: 예시 결함',
    '- PASS 근거: 예시 관측',
    `- 지침: ${guidance}`,
    '- 피함: 예시 피함',
    ...(trigger ? [`- trigger: ${trigger}`] : []),
    ...(sensor ? [`- 센서: ${sensor}`] : []),
    '',
  ].join('\n');

export const CRITERIA_ITEMS = {
  lint: { id: 'S2', guidance: 'lint 규칙이 가리키는 원인을 고친다' },
  test: { id: 'S6', guidance: '바뀐 동작의 RED 근거와 이유를 남긴다' },
  typecheck: { id: 'S7', guidance: 'type 오류의 원인 type을 맞춘다' },
};

function sweText() {
  return [
    '# SWE',
    '',
    item('S1', '요구 부합', { question: '요구를 지키는가?', guidance: '요구를 읽는다' }),
    item('S2', 'lint 항목', {
      question: 'lint 질문인가?',
      guidance: CRITERIA_ITEMS.lint.guidance,
      sensor: '{{binding:sensor.lint}}',
    }),
    item('S3', 'web trigger 항목', {
      question: 'web trigger 질문인가?',
      guidance: 'web 지침',
      trigger: '{{binding:repo-structure.fixture-web}}',
    }),
    item('S4', '넷째 항목', { question: '넷째 질문인가?', guidance: '넷째 지침' }),
    item('S5', '다섯째 항목', { question: '다섯째 질문인가?', guidance: '다섯째 지침' }),
    item('S6', '보호 test', {
      question: '보호 test가 있는가?',
      guidance: CRITERIA_ITEMS.test.guidance,
      sensor: '{{binding:sensor.test-change}}',
    }),
    item('S7', 'typecheck 항목', {
      question: 'type이 맞는가?',
      guidance: CRITERIA_ITEMS.typecheck.guidance,
      sensor: '{{binding:sensor.typecheck}}',
    }),
  ].join('\n');
}

// Each stub appends its arguments to STUB_LOG (ignored), then fails or sleeps when its input has the mark.
function stub(name, body) {
  return [
    '#!/bin/sh',
    `here=$(cd "$(dirname "$0")/../.." && pwd)`,
    `mkdir -p "$here/.artifacts"`,
    `printf '%s %s\\n' "${name}" "$*" >> "$here/${STUB_LOG}"`,
    body,
    '',
  ].join('\n');
}
const STUBS = {
  prettier: stub(
    'prettier',
    [
      'for last; do :; done',
      `if grep -q ${SLOW} "$last" 2>/dev/null; then sleep 3; fi`,
      `if grep -q ${UNFORMATTED} "$last" 2>/dev/null; then echo "[warn] $last"; echo "[warn] Code style issues found in the above file. Run Prettier with --write to fix."; exit 1; fi`,
      'exit 0',
    ].join('\n'),
  ),
  eslint: stub(
    'eslint',
    [
      'for last; do :; done',
      `if grep -q ${SLOW} "$last" 2>/dev/null; then sleep 3; fi`,
      `if grep -q ${LINT_ERROR} "$last" 2>/dev/null; then echo "$last"; echo "  1:7  error  'unused' is assigned a value but never used  no-unused-vars"; exit 1; fi`,
      'exit 0',
    ].join('\n'),
  ),
  tsc: stub(
    'tsc',
    [
      `if grep -rq ${SLOW} . --include='*.ts' 2>/dev/null; then sleep 3; fi`,
      `if grep -rq ${TYPE_ERROR} . --include='*.ts' 2>/dev/null; then echo "src/sample.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'."; exit 2; fi`,
      'exit 0',
    ].join('\n'),
  ),
};

const git = (root, ...args) =>
  execFileSync(
    'git',
    ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-C', root, ...args],
    { encoding: 'utf8' },
  );

// workspaces: the module's EDIT_SENSOR_WORKSPACES. The first one holds the sample files; every workspace gets its
// tsconfig and prerequisites unless `prerequisites: false`.
export function sensorRepo(t, { workspaces, table = sensorTable(), prerequisites = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'edit-sensors-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('.gitignore', '.artifacts/\nnode_modules/\n.codex/state/\n');
  write(BINDING, bindingText(table));
  write(`${CRITERIA_DIR}/swe.md`, sweText());
  for (const [name, text] of Object.entries(STUBS)) {
    write(`node_modules/.bin/${name}`, text);
    chmodSync(join(root, `node_modules/.bin/${name}`), 0o755);
  }
  const web = workspaces[0].dir;
  for (const workspace of workspaces) {
    write(`${workspace.dir}/${workspace.tsconfig}`, '{}\n');
    if (prerequisites)
      for (const path of workspace.prerequisites) mkdirSync(join(root, path), { recursive: true });
  }
  const files = {
    source: `${web}/src/sample.ts`,
    oldTest: `${web}/src/old.test.ts`,
    keptTest: `${web}/src/kept.test.ts`,
    doc: 'notes.md',
  };
  write(files.source, 'export const value = 1;\n');
  write(files.oldTest, 'test placeholder\n');
  write(files.keptTest, 'test placeholder\n');
  write(files.doc, '# notes\n');
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'fixture');
  return {
    root,
    files,
    write,
    remove: (path) => rmSync(join(root, path)),
    status: () => git(root, 'status', '--short'),
    stubCalls: () =>
      existsSync(join(root, STUB_LOG))
        ? readFileSync(join(root, STUB_LOG), 'utf8').trim().split('\n').filter(Boolean)
        : [],
    records: (sessionId = SESSION) => {
      const file = join(root, '.artifacts/tools/edit-sensors', `${sessionId}.jsonl`);
      return existsSync(file)
        ? readFileSync(file, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [];
    },
    appendStub: (name, text) => appendFileSync(join(root, `node_modules/.bin/${name}`), text),
  };
}

// A directory with a stub `git` (or `codex`) first on PATH: it records that it ran, then sleeps or fails.
export function stubCommand(t, name, { sleepSeconds = 0, exitCode = 0, stdout = '' } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `stub-${name}-`)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const marker = join(dir, 'calls.log');
  writeFileSync(
    join(dir, name),
    [
      '#!/bin/sh',
      `printf '%s\\n' "$*" >> "${marker}"`,
      ...(sleepSeconds ? [`sleep ${sleepSeconds}`] : []),
      ...(stdout ? [`printf '%s' '${stdout.replaceAll("'", "'\\''")}'`] : []),
      `exit ${exitCode}`,
      '',
    ].join('\n'),
  );
  chmodSync(join(dir, name), 0o755);
  return {
    dir,
    path: `${dir}:${process.env.PATH}`,
    calls: () =>
      existsSync(marker) ? readFileSync(marker, 'utf8').trim().split('\n').filter(Boolean) : [],
  };
}
