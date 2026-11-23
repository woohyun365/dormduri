import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { API_CD_DEPLOY_JOB, judgeSchemaGate, readApiCdRuns } from './schema-gate.mjs';

const sha = 'a'.repeat(40);
const older = 'b'.repeat(40);
const run = (id, headSha, status, deployConclusion) => ({ id, headSha, status, deployConclusion });
const judge = (runs, same = () => false) => judgeSchemaGate({ sha, runs, sameSchema: same });

test('the gate names the deploy job that api-cd.yml defines', () => {
  const source = readFileSync('.github/workflows/api-cd.yml', 'utf8');
  assert.match(source, new RegExp(`^  deploy:\\n    name: ${API_CD_DEPLOY_JOB}$`, 'mu'));
});

test('a schema the API stage already deployed passes without waiting', () => {
  const result = judge([run(2, older, 'completed', 'success')], (other) => other === older);
  assert.equal(result.decision, 'pass');
});

test('a changed schema waits for the same-commit api-cd deploy and passes once it succeeds', () => {
  const deployed = run(1, older, 'completed', 'success');
  assert.equal(judge([run(2, sha, 'in_progress', null), deployed]).decision, 'wait');
  assert.equal(judge([run(2, sha, 'waiting', null), deployed]).decision, 'wait');
  assert.equal(judge([run(2, sha, 'completed', 'success'), deployed]).decision, 'pass');
});

test('a changed schema stops when the same-commit api-cd deploy failed, was skipped or never ran', () => {
  const deployed = run(1, older, 'completed', 'success');
  for (const own of [
    run(2, sha, 'completed', 'failure'),
    run(2, sha, 'completed', 'cancelled'),
    run(2, sha, 'completed', 'skipped'),
    run(2, sha, 'completed', null),
    run(2, sha, 'in_progress', 'failure'),
  ]) {
    assert.equal(judge([own, deployed]).decision, 'fail', JSON.stringify(own));
  }
  assert.equal(judge([deployed]).decision, 'fail');
  // 첫 배포: api-cd가 배포에 성공한 적이 없으면 같은 commit 실행을 기다리거나 멈춘다.
  assert.equal(judge([]).decision, 'fail');
  assert.equal(judge([run(3, sha, 'queued', null)]).decision, 'wait');
});

test('the newest successful api-cd deploy decides, not an older one with the same schema', () => {
  // 더 오래된 배포가 이 schema였어도 그 뒤 배포가 다른 schema를 적용했으면 지나가지 않는다.
  const newer = 'c'.repeat(40);
  const runs = [run(3, newer, 'completed', 'success'), run(1, older, 'completed', 'success')];
  assert.equal(judge(runs, (other) => other === older).decision, 'fail');
  assert.equal(judge(runs, (other) => other === newer).decision, 'pass');
});

test('a run commit that is not a full SHA is refused', () => {
  // 같은 schema가 배포돼 full SHA면 지나가는 조건에서, branch 이름·짧은·긴·대문자 SHA는 api-cd 실행의 head SHA(소문자 40자)와
  // 대조할 수 없어 멈춘다.
  const runs = [run(1, older, 'completed', 'success')];
  assert.equal(judgeSchemaGate({ sha, runs, sameSchema: () => true }).decision, 'pass');
  for (const value of ['main', 'a'.repeat(7), 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40)]) {
    assert.equal(
      judgeSchemaGate({ sha: value, runs, sameSchema: () => true }).decision,
      'fail',
      value,
    );
  }
});

// 기다리는 동안 GITHUB_TOKEN REST 한도를 쓰지 않도록, 끝난 실행의 job 결과는 다음 회에 다시 묻지 않는다.
test('reading the api-cd runs asks for the jobs of a finished run only once', () => {
  const calls = [];
  const listed = [
    { id: 3, head_sha: sha, status: 'in_progress' },
    { id: 2, head_sha: older, status: 'completed' },
    { id: 1, head_sha: 'c'.repeat(40), status: 'completed' },
  ];
  const jobs = {
    3: [{ name: API_CD_DEPLOY_JOB, status: 'in_progress', conclusion: null }],
    2: [{ name: API_CD_DEPLOY_JOB, status: 'completed', conclusion: 'success' }],
    1: [{ name: 'Build images', status: 'completed', conclusion: 'success' }],
  };
  const request = (args) => {
    calls.push(args[1]);
    const id = /\/runs\/(\d+)\/jobs/u.exec(args[1])?.[1];
    return id ? { jobs: jobs[id] } : { workflow_runs: listed };
  };
  const completed = new Map();
  const first = readApiCdRuns('owner/repo', { request, completed });
  assert.deepEqual(first, [
    run(3, sha, 'in_progress', null),
    run(2, older, 'completed', 'success'),
    run(1, 'c'.repeat(40), 'completed', null),
  ]);
  assert.equal(calls.length, 4);
  calls.length = 0;
  assert.deepEqual(readApiCdRuns('owner/repo', { request, completed }), first);
  assert.deepEqual(calls, [
    'repos/owner/repo/actions/workflows/api-cd.yml/runs?branch=main&event=push&per_page=30',
    'repos/owner/repo/actions/runs/3/jobs?per_page=50',
  ]);
});
