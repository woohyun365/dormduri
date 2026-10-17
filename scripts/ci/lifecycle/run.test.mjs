import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { defaultFiles, prBody } from './fixtures/policy-repo.mjs';
import { LIFECYCLE_CHECKS, renderSummary, runLifecycleGate } from './run.mjs';

const runScript = fileURLToPath(new URL('./run.mjs', import.meta.url));
const bodyFixture = (name) => fileURLToPath(new URL(`./fixtures/bodies/${name}`, import.meta.url));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeFiles(root, files) {
  for (const [path, text] of Object.entries(files)) {
    const target = resolve(root, path);
    if (text === null) {
      rmSync(target, { force: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

// base: dev before the branch, head: the PR branch, moved: dev after the branch point (its paths are not the PR's).
function fixtureRepository(t, { head = {}, moved = {} } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-lifecycle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'dev');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'config', 'user.name', 'fixture');
  git(root, 'config', 'commit.gpgsign', 'false');
  writeFiles(root, defaultFiles());
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const forkPoint = git(root, 'rev-parse', 'HEAD');
  git(root, 'switch', '-q', '-c', 'feature');
  writeFiles(root, head);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'head');
  const headSha = git(root, 'rev-parse', 'HEAD');
  git(root, 'switch', '-q', 'dev');
  writeFiles(root, moved);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'moved');
  const baseSha = git(root, 'rev-parse', 'HEAD');
  return { root, forkPoint, headSha, baseSha };
}

function pullRequestEnv(t, repo, { baseSha = repo.baseSha } = {}) {
  const eventPath = resolve(repo.root, '..', `${repo.root.split('/').pop()}-event.json`);
  const summaryPath = resolve(repo.root, '..', `${repo.root.split('/').pop()}-summary.md`);
  t.after(() => {
    rmSync(eventPath, { force: true });
    rmSync(summaryPath, { force: true });
  });
  writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 7,
        base: { sha: baseSha, ref: 'dev' },
        head: { sha: repo.headSha },
        user: { login: 'event-author' },
      },
    }),
  );
  writeFileSync(summaryPath, '');
  return {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_API_URL: 'https://api.github.invalid',
      GITHUB_TOKEN: 'token-for-test',
      GITHUB_STEP_SUMMARY: summaryPath,
    },
    summaryPath,
  };
}

const pullRequestResponse =
  (body, { login = 'woohyun365', baseRef = 'dev' } = {}) =>
  async (url, options) => {
    assert.equal(url, 'https://api.github.invalid/repos/owner/repo/pulls/7');
    assert.equal(options.headers.Authorization, 'Bearer token-for-test');
    return new Response(JSON.stringify({ body, user: { login }, base: { ref: baseRef } }), {
      status: 200,
    });
  };

test('run.mjs registers the policy-first check and leaves L-CONFIRM out of overrides', () => {
  assert.deepEqual(
    LIFECYCLE_CHECKS.map((check) => [check.name, check.nonOverridable]),
    [['policy-first', ['L-CONFIRM']]],
  );
});

test('the gate diffs from the merge-base, reads the current body and fails on a grounded-less product change', async (t) => {
  const repo = fixtureRepository(t, {
    head: { 'apps/api/src/matches/matches.service.ts': '// changed\n' },
    moved: { 'apps/api/src/chat/chat.service.ts': '// dev moved\n' },
  });
  const { env, summaryPath } = pullRequestEnv(t, repo);

  const result = await runLifecycleGate({
    env,
    cwd: repo.root,
    fetchImpl: pullRequestResponse(prBody()),
  });

  assert.equal(result.exitCode, 1);
  const summary = readFileSync(summaryPath, 'utf8');
  assert.match(summary, /^### Lifecycle gate$/mu);
  assert.match(
    summary,
    /\| W-SCOPE \| fail \| 판정 도메인이 선언에 없음: matching-algorithm, matching-lifecycle \|/u,
  );
  assert.match(summary, /\| W-IRREV \| pass \|/u);
  assert.match(summary, /\| L-CONFIRM \| pass \|/u);
  assert.doesNotMatch(
    summary,
    /chat-lifecycle/u,
    'a path changed only on the base branch is not part of the PR',
  );
  assert.match(summary, new RegExp(`merge-base \`${repo.forkPoint.slice(0, 12)}`, 'u'));
});

test('RED 9: a pull request body API error fails the job closed', async (t) => {
  const repo = fixtureRepository(t, {
    head: { 'apps/api/src/matches/matches.service.ts': '// x\n' },
  });
  const { env, summaryPath } = pullRequestEnv(t, repo);

  const result = await runLifecycleGate({
    env,
    cwd: repo.root,
    fetchImpl: async () => new Response('{"message":"Bad credentials"}', { status: 401 }),
  });

  assert.equal(result.exitCode, 2);
  assert.match(readFileSync(summaryPath, 'utf8'), /job 실패: PR 본문을 읽지 못함: HTTP 401/u);
});

test('RED 9: a malformed path table or tracking record fails the job closed', async (t) => {
  for (const [path, text, reason] of [
    [
      'docs/policies/path-domains.json',
      '{ "schema": ',
      /docs\/policies\/path-domains\.json 형식 오류/u,
    ],
    [
      'docs/policies/path-domains.json',
      JSON.stringify({ schema: 'lifecycle-path-domains/v1' }),
      /docs\/policies\/path-domains\.json 형식 오류: confirmedBy/u,
    ],
    ['docs/product/artifact-map.json', '[]', /docs\/product\/artifact-map\.json 형식 오류/u],
  ]) {
    const repo = fixtureRepository(t, {
      head: { [path]: text, 'apps/api/src/matches/matches.service.ts': '// x\n' },
    });
    const { env, summaryPath } = pullRequestEnv(t, repo);

    const result = await runLifecycleGate({
      env,
      cwd: repo.root,
      fetchImpl: pullRequestResponse(prBody()),
    });

    assert.equal(result.exitCode, 2, path);
    assert.match(readFileSync(summaryPath, 'utf8'), reason);
  }
});

test('RED 9: an unknown base commit fails the job closed instead of falling back', async (t) => {
  const repo = fixtureRepository(t);
  const { env, summaryPath } = pullRequestEnv(t, repo, { baseSha: 'f'.repeat(40) });

  const result = await runLifecycleGate({
    env,
    cwd: repo.root,
    fetchImpl: pullRequestResponse(prBody()),
  });

  assert.equal(result.exitCode, 2);
  assert.match(readFileSync(summaryPath, 'utf8'), /job 실패: merge-base/u);
});

test('the author and base branch come from the REST response, not the event payload', async (t) => {
  const repo = fixtureRepository(t, {
    head: { 'apps/api/src/matches/matches.service.ts': '// x\n' },
  });
  const { env, summaryPath } = pullRequestEnv(t, repo);

  const result = await runLifecycleGate({
    env,
    cwd: repo.root,
    fetchImpl: pullRequestResponse(prBody(), { login: 'renovate[bot]' }),
  });

  assert.equal(result.exitCode, 0);
  assert.match(readFileSync(summaryPath, 'utf8'), /경고로 낮춤: author renovate\[bot\]/u);
});

test('the summary escapes table separators and never starts a line with a workflow command', () => {
  const summary = renderSummary({
    meta: {
      number: 7,
      author: '::error::x',
      baseRef: 'dev',
      revisions: { base: 'a'.repeat(40), mergeBase: 'b'.repeat(40), head: 'c'.repeat(40) },
      changedPaths: [],
      grade: { declared: null, effective: 'feature' },
    },
    evaluation: {
      failed: false,
      downgrade: null,
      findings: [{ check: '(형식)', level: 'warn', reason: 'a | b\n::warning::c' }],
    },
  });

  assert.match(summary, /\| \(형식\) \| warn \| a \\\| b ::warning::c \|/u);
  for (const line of summary.split('\n')) assert.doesNotMatch(line, /^::/u, line);
});

test('local mode reads a body file and explicit revisions', async (t) => {
  const repo = fixtureRepository(t, {
    head: { 'apps/api/prisma/migrations/20261017000000_fix/migration.sql': '-- fix\n' },
  });

  const run = spawnSync(
    process.execPath,
    [
      runScript,
      '--body-file',
      bodyFixture('bugfix-migration-override.md'),
      '--base',
      repo.baseSha,
      '--head',
      repo.headSha,
    ],
    { cwd: repo.root, encoding: 'utf8' },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.match(
    run.stdout,
    /\| W-IRREV \| warn \| 비가역 경로 변경: apps\/api\/prisma\/migrations\/20261017000000_fix\/migration\.sql/u,
  );

  const withoutSection = spawnSync(
    process.execPath,
    [
      runScript,
      '--body-file',
      bodyFixture('without-section.md'),
      '--base',
      repo.baseSha,
      '--head',
      repo.headSha,
    ],
    { cwd: repo.root, encoding: 'utf8' },
  );
  assert.equal(withoutSection.status, 1, withoutSection.stderr);
  assert.match(
    withoutSection.stdout,
    /\| \(형식\) \| warn \| Lifecycle 절 없음: feature로 계산 \|/u,
  );
  assert.match(
    withoutSection.stdout,
    /\| W-SCOPE \| fail \| 판정 도메인이 선언에 없음: production-runtime-safety \|/u,
  );
});
