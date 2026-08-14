import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateCommitMessage } from './validate-commit-message.mjs';

const repoRoot = process.cwd();

test('accepts repository titles with or without an issue reference', () => {
  for (const message of [
    'feat(auth): 로그인 세션 경계를 명확히 한다 #299',
    'test(ci): GitHub workflow 계약을 고정한다',
    'refactor(api-test): 테스트 책임을 정리한다\n\nConfidence: high\n',
  ]) {
    assert.deepEqual(validateCommitMessage(message), [], message);
  }
});

test('accepts Git-generated merge, revert, and autosquash titles', () => {
  for (const title of [
    'Merge pull request #302 from example/branch',
    'Revert "feat(auth): 로그인 흐름을 변경한다"',
    'fixup! feat(auth): 로그인 흐름을 변경한다',
    'squash! docs(repo): 문서 책임을 정리한다',
    'amend! chore(repo): 커밋 메시지를 보강한다',
  ]) {
    assert.deepEqual(validateCommitMessage(title), [], title);
  }
});

test('rejects invalid type, missing scope, non-Korean summary, and malformed issue', () => {
  assert.match(validateCommitMessage('feature(auth): 로그인 흐름을 변경한다').join('\n'), /type/u);
  assert.match(validateCommitMessage('feat: 로그인 흐름을 변경한다').join('\n'), /형식/u);
  assert.match(validateCommitMessage('feat(auth): improve login').join('\n'), /한글/u);
  assert.match(validateCommitMessage('feat(auth): 로그인 흐름을 변경한다 #0').join('\n'), /이슈/u);
  assert.match(
    validateCommitMessage('feat(auth): 로그인 흐름을 변경한다 #12abc').join('\n'),
    /이슈/u,
  );
});

test('rejects literal backslash-n while allowing real multiline bodies', () => {
  assert.match(
    validateCommitMessage('fix(auth): 로그인 오류를 수정한다\\n\\nTested: unit').join('\n'),
    /literal/u,
  );
  assert.deepEqual(
    validateCommitMessage('fix(auth): 로그인 오류를 수정한다\n\nTested: unit\n'),
    [],
  );
});

test('CLI returns a non-zero status with an actionable error', () => {
  const directory = mkdtempSync(join(tmpdir(), 'knu-commit-message-'));
  const messagePath = join(directory, 'COMMIT_EDITMSG');
  writeFileSync(messagePath, 'feat: invalid title\n');

  try {
    const result = spawnSync(
      process.execPath,
      [resolve(repoRoot, 'scripts/git/validate-commit-message.mjs'), messagePath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /type\(scope\)/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
