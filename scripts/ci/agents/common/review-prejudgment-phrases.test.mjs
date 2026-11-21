import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const MODULE = resolve(repoRoot, 'scripts/agents/common/review-prejudgment-phrases.mjs');
const SESSION = '0c9b8a7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d';
async function phrases() {
  try {
    return await import('../../../agents/common/review-prejudgment-phrases.mjs');
  } catch {
    assert.fail('review-prejudgment-phrases module is not implemented');
  }
}

// RED 9: the four superpowers phrases and their Korean counterparts warn; "무시" and scope narrowing in general do not.
test('the superpowers phrases and their Korean counterparts are found; ignore and scope phrases in general are not', async () => {
  const { prejudgmentPhraseMatches } = await phrases();
  const hits = (sentence) => prejudgmentPhraseMatches({ request: sentence, acceptance: [] }).length;
  for (const sentence of [
    'Please do not flag the missing test.',
    "Don't flag the retry loop.",
    "Don't treat the mock as a defect.",
    'Grade this at most Minor.',
    'The plan chose this layout.',
    '이 부분은 지적하지 말고 넘어간다.',
    'mock 사용은 결함으로 보지 않는다.',
    '이 항목 finding은 최대 low로 매긴다.',
    'plan이 이미 정했으므로 다시 보지 않는다.',
  ])
    assert.equal(hits(sentence), 1, sentence);
  for (const sentence of [
    '포맷 차이는 무시해도 된다.',
    'test 파일은 보지 않아도 된다.',
    '이 절은 리뷰 대상이 아니다.',
    '범위 밖이니 넘어간다.',
    '변경이 Owner 2.4 (a) 문장과 같은지 판정한다.',
    'hook은 출력 없이 끝나는 오류를 무시한다.',
  ])
    assert.equal(hits(sentence), 0, sentence);
});

test('request, acceptance and the requirement extract are each read and named in the match', async () => {
  const { prejudgmentPhraseMatches } = await phrases();
  const matches = prejudgmentPhraseMatches({
    request: '변경을 독립 검토해줘.',
    acceptance: ['RED 1이 기대 사유로 실패한다.', '이 항목은 최대 low로 본다.'],
    requirements: '## 2. Acceptance\n- [ ] the plan chose the default\n',
  });
  assert.deepEqual(
    matches.map(({ field }) => field),
    ['acceptance', 'requirements'],
  );
  assert.ok(matches.every(({ phrase }) => typeof phrase === 'string' && phrase));
  assert.deepEqual(
    prejudgmentPhraseMatches({ request: '독립 검토해줘.', acceptance: ['통과한다.'] }),
    [],
  );
});

test('the CLI prints the count, records a review-point warning for a session and never refuses', async (t) => {
  await phrases();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'prejudgment-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = join(root, 'subject.json');
  const run = (...args) =>
    spawnSync(process.execPath, [MODULE, '--root', root, ...args], { encoding: 'utf8' });
  const records = () => {
    const file = join(root, '.artifacts/tools/edit-sensors', `${SESSION}.jsonl`);
    return existsSync(file)
      ? readFileSync(file, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      : [];
  };
  writeFileSync(input, JSON.stringify({ request: '검토해줘.', acceptance: ['지적하지 말 것.'] }));
  const warned = run('--input', input, '--session', SESSION, '--host', 'codex');
  assert.equal(warned.status, 0, warned.stderr);
  const output = JSON.parse(warned.stdout);
  assert.equal(output.count, 1);
  assert.match(output.warning, /^review-prejudgment-phrase: 1 /u);
  const [record, ...rest] = records();
  assert.deepEqual(rest, []);
  assert.deepEqual(
    [record.schema, record.host, record.point, record.sensor, record.result, record.sessionId],
    ['edit-sensor-activation/v1', 'codex', '리뷰', 'review-prejudgment-phrase', 'warning', SESSION],
  );
  writeFileSync(input, JSON.stringify({ request: '검토해줘.', acceptance: ['통과한다.'] }));
  const clean = run('--input', input, '--session', SESSION, '--host', 'codex');
  assert.equal(clean.status, 0, clean.stderr);
  assert.deepEqual(JSON.parse(clean.stdout), { count: 0, matches: [] });
  assert.equal(records().length, 1, 'no record without a phrase');
  assert.equal(run('--session', SESSION).status, 2, 'an input file is required');
});
