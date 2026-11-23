#!/usr/bin/env node
// backoffice-cd의 schema 순서 gate(backoffice-foundation D-BF16, umbrella D-SF15). 백오피스 API는 migration을 실행하지 않으므로
// (D-SF5) 운영 DB schema는 api-cd가 적용한 것이다. push 실행은 api-cd가 마지막으로 host 배포에 성공한 push commit의
// `packages/database/prisma`가 이 commit과 같을 때만 지나간다. 다르면 이 commit의 api-cd push 실행이 배포에 성공할 때까지
// 제한 시간 안에서 기다리고, 그 실행이 실패·취소되거나 없으면 멈춘다. migration은 앞으로만 가므로(되돌리지 않음) api-cd
// rollback·dispatch 실행은 schema를 바꾸지 않아 세지 않는다. 첫 배포도 같은 규칙이다(앞선 api-cd가 이 schema를 적용했어야 한다).
// 기다리는 동안 GITHUB_TOKEN의 REST 한도(저장소당 시간 1,000건)를 쓰지 않도록, 끝난 실행의 job 결과는 다시 묻지 않고(매 회 목록
// 1건과 끝나지 않은 실행 수만큼) 60초마다 본다. 목록을 읽지 못하면 제한 시간까지 다시 시도한다.
//
//   node scripts/infra/backoffice-host/schema-gate.mjs --sha=<이 실행 commit>
// 환경: GH_TOKEN(actions: read), GITHUB_REPOSITORY. 출력에는 run 번호·commit만 쓴다.
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_CD_WORKFLOW = 'api-cd.yml';
// api-cd에서 migrate·grant·rollout을 host에 보내는 job의 이름(api-cd.yml `deploy` job의 name).
export const API_CD_DEPLOY_JOB = 'Verify and deploy to the user host';
export const SCHEMA_PATH = 'packages/database/prisma';
const COMMIT = /^[a-f0-9]{40}$/u;

// runs: api-cd push 실행(최신순) [{ id, headSha, status, deployConclusion }]. deployConclusion은 deploy job의 conclusion이고
// job이 아직 없거나 끝나지 않았으면 null이다. sameSchema(sha)는 그 commit의 schema 경로가 이 commit과 같은지다.
// 결과: { decision: 'pass' | 'wait' | 'fail', reason }.
export function judgeSchemaGate({ sha, runs, sameSchema }) {
  if (!COMMIT.test(sha ?? ''))
    return { decision: 'fail', reason: 'the run commit is not a full SHA' };
  const deployed = runs.find((run) => run.deployConclusion === 'success');
  if (deployed && sameSchema(deployed.headSha)) {
    return {
      decision: 'pass',
      reason: `api-cd run ${deployed.id} deployed commit ${deployed.headSha} with the same ${SCHEMA_PATH}`,
    };
  }
  const own = runs.find((run) => run.headSha === sha);
  if (!own) {
    return {
      decision: 'fail',
      reason: `the deployed schema differs and api-cd has no push run for ${sha}; deploy the API stage first`,
    };
  }
  if (own.status !== 'completed' && own.deployConclusion === null) {
    return {
      decision: 'wait',
      reason: `api-cd run ${own.id} for this commit has not deployed yet`,
    };
  }
  if (own.deployConclusion === 'success') {
    return { decision: 'pass', reason: `api-cd run ${own.id} deployed this commit` };
  }
  return {
    decision: 'fail',
    reason: `api-cd run ${own.id} for this commit ended without a successful deploy (${own.deployConclusion ?? own.status})`,
  };
}

function gh(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
}

// api-cd의 main push 실행 최근 30개와 각 실행의 deploy job 결과. 끝난 실행(status completed)의 결과는 바뀌지 않으므로 `completed`에
// 두고 다음 회에는 묻지 않는다. `request`는 gh api 인자를 받아 JSON을 돌려준다(test가 바꿔 끼운다).
export function readApiCdRuns(repository, { request = gh, completed = new Map() } = {}) {
  const { workflow_runs: list } = request([
    'api',
    `repos/${repository}/actions/workflows/${API_CD_WORKFLOW}/runs?branch=main&event=push&per_page=30`,
  ]);
  return list.map((run) => {
    if (completed.has(run.id)) return completed.get(run.id);
    const { jobs } = request([
      'api',
      `repos/${repository}/actions/runs/${run.id}/jobs?per_page=50`,
    ]);
    const deploy = jobs.find((job) => job.name === API_CD_DEPLOY_JOB);
    const result = {
      id: run.id,
      headSha: run.head_sha,
      status: run.status,
      deployConclusion: deploy && deploy.status === 'completed' ? deploy.conclusion : null,
    };
    if (run.status === 'completed') completed.set(run.id, result);
    return result;
  });
}

function sameSchemaAs(sha) {
  return (other) => {
    if (!COMMIT.test(other ?? '')) return false;
    const result = spawnSync('git', ['diff', '--quiet', other, sha, '--', SCHEMA_PATH]);
    if (result.status === 0) return true;
    if (result.status === 1) return false;
    throw new Error(`could not compare ${SCHEMA_PATH} with commit ${other}`);
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = (name) =>
    process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const sha = option('sha');
  const limitSeconds = Number(process.env.SCHEMA_GATE_WAIT_SECONDS ?? 5400);
  const pollSeconds = Number(process.env.SCHEMA_GATE_POLL_SECONDS ?? 60);
  const deadline = Date.now() + limitSeconds * 1000;
  const completed = new Map();
  const sameSchema = sameSchemaAs(sha);
  for (;;) {
    let runs = null;
    try {
      runs = readApiCdRuns(process.env.GITHUB_REPOSITORY, { completed });
    } catch (error) {
      // rate limit·일시 오류. 판정하지 않고 다음 회에 다시 읽는다(제한 시간이 지나면 아래에서 멈춘다).
      console.log(
        `retry: could not read the api-cd runs (${String(error.message).split('\n')[0]})`,
      );
    }
    if (runs) {
      const result = judgeSchemaGate({ sha, runs, sameSchema });
      console.log(`${result.decision}: ${result.reason}`);
      if (result.decision === 'pass') process.exit(0);
      if (result.decision === 'fail') process.exit(1);
    }
    if (Date.now() >= deadline) {
      console.log(
        `stopped: the API stage did not deploy this schema within ${limitSeconds} seconds`,
      );
      process.exit(1);
    }
    spawnSync('sleep', [String(pollSeconds)]);
  }
}
