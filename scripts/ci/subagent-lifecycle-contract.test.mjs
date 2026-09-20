import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const guidePath = 'docs/development/agent-workflows/subagent-lifecycle.md';
const troublePath = 'docs/development/troubleshooting/tooling/agent-thread-limit-reached.md';
const ownerPaths = [
  guidePath,
  troublePath,
  'docs/development/agent-workflows/orchestration.md',
  'docs/development/agent-workflows/session-continuity.md',
  'docs/development/agent-workflows/request-intake/delegation.md',
  'docs/development/agent-workflows/request-intake/orchestration-recovery.md',
];
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const compact = (source) => source.replace(/\s+/gu, ' ');
const section = (path, heading) => {
  const source = read(path).split(`## ${heading}\n`)[1]?.split('\n## ')[0];
  assert.ok(source, `${path}: ${heading}`);
  return compact(source);
};

// Documentation contracts, not a native lifecycle engine or proof of real slot release.
test('startup and orchestration entry points route completion and capacity recovery to one owner', () => {
  for (const path of [
    'AGENTS.md',
    'docs/development/agent-workflows/README.md',
    'docs/development/agent-workflows/orchestration.md',
    'docs/development/agent-workflows/request-intake/orchestration-recovery.md',
  ]) {
    assert.match(read(path), /subagent-lifecycle\.md/u, path);
  }
  const guide = read(guidePath);
  assert.match(guide, /child 작업 완료/u);
  assert.match(guide, /agent thread limit reached/u);
  assert.match(guide, /Parent가.*소유/u);
  assert.match(guide, /child 상한 6/u);
});

test('completion, thread closure and released slots remain different observations', () => {
  const guide = read(guidePath);
  for (const state of [
    'completed',
    'closed-confirmed',
    'release-confirmed',
    'release-unverified',
    'retained-with-reason',
    'cleanup-unavailable',
    'cleanup-failed',
  ]) {
    assert.ok(guide.includes(state), state);
  }
  assert.match(guide, /interrupt_agent.*슬롯 해제.*아니다/u);
  assert.match(guide, /archive.*close.*동등.*추측하지/u);
});

test('cleanup captures outputs before exact owned terminal target revalidation and supported close', () => {
  const guide = read(guidePath);
  const orderedSteps = ['결과 보존', '대상 재확인', '지원 close 호출', '해제 확인'];
  let previous = -1;
  for (const step of orderedSteps) {
    const position = guide.indexOf(`**${step}**`);
    assert.ok(position > previous, step);
    previous = position;
  }
  assert.match(guide, /running.*waiting.*unknown.*닫지 않는다/u);
  assert.match(guide, /다른 parent.*다른 session/u);
  assert.match(guide, /reason.*revisit/u);
});

test('capacity recovery is bounded and missing support cannot become fake independent QA', () => {
  const guide = read(guidePath);
  assert.match(guide, /post-cleanup.*최대 1회/u);
  assert.match(guide, /orchestration-recovery\.md#recovery-ceiling/u);
  assert.match(guide, /같은 상태.*반복.*금지/u);
  assert.match(guide, /self-review.*독립.*대체.*않/u);
  assert.match(guide, /상한 우회[\s\S]*외부[\s\S]*금지/u);
  assert.match(guide, /SQLite[\s\S]*수동[\s\S]*금지/u);
});

test('troubleshooting links the canonical procedure and states runtime verification gaps', () => {
  const source = read(troublePath);
  for (const heading of ['증상', '원인', '해결', '검증', '참고']) {
    assert.ok(source.includes(`## ${heading}`), heading);
  }
  assert.match(source, /subagent-lifecycle\.md/u);
  assert.match(
    read('docs/development/troubleshooting/README.md'),
    /agent-thread-limit-reached\.md/u,
  );
  assert.match(source, /정적.*실제.*슬롯.*증명하지/u);
  assert.match(source, /learn\.chatgpt\.com\/docs\/agent-configuration\/subagents/u);
});

test('capability guidance separates official tool families from live schema and limits', () => {
  const guide = read(guidePath);
  assert.match(guide, /## Capability 확인과 tool family/u);
  for (const tool of [
    'send_input',
    'resume_agent',
    'close_agent',
    'followup_task',
    'send_message',
  ]) {
    assert.ok(guide.includes(`\`${tool}\``), tool);
  }
  assert.match(guide, /developers\.openai\.com\/api\/docs\/guides\/responses-multi-agent/u);
  assert.match(guide, /learn\.chatgpt\.com\/docs\/config-file\/config-reference/u);
  assert.match(compact(guide), /active turn.*resident.*open thread.*서로 다른/u);
  assert.match(guide, /도구 이름.*host.*단정하지/u);
});

test('capability closeout separates known no-close from unknown and native release', () => {
  const body = section(guidePath, 'Capability별 완료 판정');
  for (const value of ['explicit-close', 'verified-no-close', 'unknown', 'not-required']) {
    assert.ok(body.includes(value), value);
  }
  for (const field of [
    'resultDisposition',
    'cleanupDisposition',
    'closeDisposition',
    'releaseDisposition',
  ]) {
    assert.ok(body.includes(field), field);
  }
  assert.match(body, /close=false.*자동.*not-required.*않/u);
  assert.match(body, /pendingMailbox.*누락.*0.*간주하지/u);
  assert.match(body, /작업 결과.*회수.*release-unverified/u);
  assert.match(body, /host.*인증.*권한.*생성하지/u);
  const entry = section(ownerPaths[2], 'Subagent lifecycle');
  assert.match(entry, /capability.*분기/u);
  assert.doesNotMatch(entry, /완료 thread를 지원 도구로 종료한 뒤/u);
});

test('task, residency, persistent history and operator control plane have separate owners', () => {
  const body = section(guidePath, '상태와 책임 경계');
  for (const state of [
    'Task/turn',
    'Runtime residency',
    'Persistent session',
    'Operator control plane',
  ]) {
    assert.ok(body.includes(state), state);
  }
  const closeout = section(guidePath, 'Parent closeout');
  assert.match(closeout, /결과 회수.*cleanup.*release/u);
  assert.match(closeout, /not-required.*슬롯.*증거.*아/u);
  const flow = section(guidePath, '후속 작업과 fan-in');
  assert.match(flow, /감사.*메시지.*보내지/u);
  assert.match(flow, /최초.*독립/u);
});

test('cold resume has pinned support evidence without current-host restoration guarantees', () => {
  const body = section(guidePath, 'Cold resume 경계');
  assert.match(body, /multi_agent_resume\.rs/u);
  assert.match(body, /현재 host.*보장하지/u);
  assert.match(body, /not-observed.*삭제.*단정하지/u);
  assert.match(body, /identity.*role.*권한.*snapshot/u);
  const continuity = compact(read(ownerPaths[3]));
  assert.match(continuity, /subagent-lifecycle\.md#cold-resume-경계/u);
  assert.match(continuity, /저장된.*ID.*실행 권한.*아/u);
});

test('capacity and mode claims are version-scoped and cannot justify root rollover', () => {
  const guide = compact(read(guidePath));
  assert.match(guide, /rust-v0\.155\.1/u);
  assert.match(guide, /multi_agent_v2=false.*V1 강제.*아/u);
  assert.match(guide, /root 포함.*child.*숫자.*복사하지/u);
  assert.match(guide, /config\/mod\.rs#L2715-L2728/u);
  assert.match(guide, /residency\.rs#L80-L238/u);
  for (const path of [guidePath, troublePath]) {
    const text = compact(read(path));
    assert.match(text, /root rollover.*우회.*금지/u, path);
    assert.doesNotMatch(text, /Codex 설정의.*동시에 열린 child thread 상한입니다/u, path);
  }
});

test('optional shared operator procedure preserves exact root, pending and distinct stop scopes', () => {
  const body = section(troublePath, '선택적 /agents 운영과 정상 exit/resume');
  let previous = -1;
  for (const step of [
    '현재 command/version 확인',
    '정확한 부모 세션 확인',
    'pending과 결과 회수',
    '정상 exit/resume',
    '재개 후 재확인',
  ]) {
    const position = body.indexOf(`**${step}**`);
    assert.ok(position > previous, step);
    previous = position;
  }
  for (const value of ['/agents', '/subagents', 'worktree', 'daemon', 'archive', 'delete']) {
    assert.ok(body.includes(value), value);
  }
  assert.match(body, /single-root.*기본/u);
  assert.match(body, /서버.*자동.*시작하지/u);
  assert.match(body, /client.*환경 격리.*제공하지/u);
  assert.match(body, /exit.*daemon.*종료.*동일.*아/u);
  assert.match(body, /archive.*delete.*슬롯.*수단.*아/u);
  assert.match(body, /codex resume <SESSION_ID>/u);
});

test('existing advisory delivery and recovery owners preserve independent gates and bounded reuse', () => {
  const delegation = compact(read(ownerPaths[4]));
  assert.match(delegation, /initial-review.*fresh scoped/u);
  assert.match(delegation, /review-delta.*같은 reviewer/u);
  assert.match(delegation, /role-compatible.*context gate.*생략하지/u);
  assert.match(delegation, /applied=false/u);
  assert.match(delegation, /numeric fork.*필수.*아/u);
  const recovery = compact(read(ownerPaths[5]));
  assert.match(recovery, /capability.*분기/u);
  assert.match(recovery, /one-alternate ceiling/u);
  assert.match(recovery, /no-close.*dispatch.*차단.*아/u);
  assert.match(recovery, /별도 release 관측 없이 자원\/슬롯 회수 성공/u);
  assert.match(compact(read(ownerPaths[2])), /weekly usage.*null\/unknown.*0.*아/u);
});

test('continuation distinguishes message delivery, task activation and result collection', () => {
  const guide = read(guidePath);
  const section = guide.split('## 후속 작업과 fan-in')[1]?.split('\n## ')[0];
  assert.ok(section, 'bounded continuation procedure');
  assert.match(section, /send_message.*새 turn을 시작하지/u);
  assert.match(section, /followup_task.*non-root/u);
  assert.match(section, /task.*snapshot.*acceptance/u);
  assert.match(section, /timeout.*완료.*아님/u);
  assert.match(section, /이전 final.*새 task.*완료.*않/u);
  assert.match(section, /cap.*우회.*아님/u);
  assert.match(section, /QA.*독립/u);
});

test('missing tools use diagnosis and scoped resume without guaranteed capability upgrades', () => {
  const source = read(troublePath).replace(/\s+/gu, ' ');
  assert.match(source, /## 도구 미노출과 restart\/resume/u);
  assert.match(source, /agents\.enabled/u);
  assert.match(source, /features\.multi_agent/u);
  assert.match(source, /codex resume <SESSION_ID>/u);
  assert.match(source, /resume_agent.*codex resume.*다른/u);
  assert.match(source, /재시작.*close_agent.*보장하지/u);
  assert.match(source, /현재.*schema.*재확인/u);
  assert.match(source, /자동.*재시작.*하지/u);
  assert.match(
    read('docs/development/agent-workflows/session-continuity.md'),
    /subagent-lifecycle\.md/u,
  );
});

test('stop and resume do not silently reopen owned writes or supply native capabilities', () => {
  const guide = read(guidePath);
  assert.match(guide, /resume_agent.*노출.*schema/u);
  assert.match(guide, /interrupt.*진행 중.*도구.*취소.*보장하지/u);
  assert.match(guide, /writer.*재배정.*pending/u);
  assert.match(guide, /지침.*native tool.*생성하지/u);
  assert.match(guide, /새 task 이름.*retry ceiling.*초기화하지/u);
});

test('lifecycle guides use portable links and do not depend on a local implementation plan', () => {
  for (const path of ownerPaths) {
    const source = read(path);
    assert.doesNotMatch(source, /\bPhase\s+\d|\/Users\/|\/private\/tmp\//u);
    // Continuity legitimately documents generic plan locations, not a dependency
    // on this task's ignored plan. Lifecycle guides must remain plan-independent.
    if (path !== ownerPaths[3]) assert.doesNotMatch(source, /\.omx\/plans\//u);
    for (const [, href] of source.matchAll(/\]\(([^)]+)\)/gu)) {
      if (/^https?:/u.test(href) || href.startsWith('#')) continue;
      const target = resolve(dirname(resolve(repoRoot, path)), href.split('#')[0]);
      assert.ok(readFileSync(target, 'utf8').length > 0, `${path}: ${href}`);
    }
  }
});
