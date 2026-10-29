#!/usr/bin/env node
// Review snapshot checks (W-REVIEW, W-CAUSE) of the Lifecycle gate. Both only warn and never throw: a comparison the
// repository cannot answer becomes a warning, so the job never fails on these checks' own inputs.
// - W-REVIEW: the last well-formed `리뷰 PASS` line is the PR head with no uncommitted or untracked changes; a PR that
//   changes a rescore trigger path carries a `재채점` line.
// - W-CAUSE: a bugfix or hotfix carries a `원인 PR` line.
// The values come from the shared review result (`reviewedSnapshot`), never from a host adapter digest.
// Authoring rules: docs/development/github/collaboration.md (`Lifecycle` 절).
//
// Usage: node scripts/ci/lifecycle/review-snapshot-check.mjs --result <review result JSON>
// Prints the `- 리뷰 PASS: …` line of a PASS result. Exit 0 = printed, 2 = input error (unreadable file, not a PASS,
// malformed snapshot).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { parseReviewPass } from './lifecycle-section.mjs';
import { globToRegExp } from './policy-first-check.mjs';

const REVIEW_CHECK_ID = 'W-REVIEW';
const CAUSE_CHECK_ID = 'W-CAUSE';
const CAUSE_GRADES = ['bugfix', 'hotfix'];
// Paths whose change asks for a held-out rescore: review criteria, reviewer prompt sources and model policies. Binding
// and pack documents are left out (a rescore fixes `--criteria`, so it does not measure selection changes).
export const RESCORE_TRIGGER_PATHS = [
  'docs/development/agent-workflows/review-criteria/**',
  'scripts/agents/claude/native-task-helper.mjs',
  'scripts/agents/common/review-context-inputs.mjs',
  '.claude/agents/knu_reviewer.md',
  '.codex/agents/knu_reviewer.toml',
  '.agents/skills/knu-review/SKILL.md',
  'scripts/agents/claude/model-policy.mjs',
  'scripts/agents/codex/model-profiles.mjs',
];
const TRIGGER_PATTERNS = RESCORE_TRIGGER_PATHS.map(globToRegExp);
const DISPATCH_PREFIX = 'review-dispatch-';
const COMMIT = /^[0-9a-f]{40}$/u;
const DIGEST = /^(?:sha256:)?([0-9a-f]{64})$/u;

const short = (sha) => sha.slice(0, 12);
const firstLine = (error) =>
  String(error?.stderr || error?.message || error)
    .trim()
    .split('\n')[0];

// The PASS head against the PR head: null when they are equal, else the warning reason.
function headMismatch(context, passHead) {
  const prHead = context.revisions.head;
  if (passHead === prHead) return null;
  const label = `PASS head ${short(passHead)}`;
  try {
    if (!context.hasCommit(passHead)) return `${label}를 저장소에서 찾지 못함(rebase 등)`;
    const paths = context.diffPaths(passHead, prHead);
    return `${label} ≠ PR head ${short(prHead)}, PASS 뒤 바뀐 파일 ${paths.length}개: ${paths.join(', ')}`;
  } catch (error) {
    return `${label}와 PR head ${short(prHead)} 비교 실패: ${firstLine(error)}`;
  }
}

function reviewSnapshotFindings(context, add) {
  const { reviewPasses } = context.section;
  for (const line of reviewPasses)
    if (!line.snapshot) add('warn', `형식이 틀린 리뷰 PASS 줄(대조하지 않음): ${line.value}`);
  const last = reviewPasses.findLast((line) => line.snapshot)?.snapshot;
  if (!last) {
    if (!reviewPasses.length) add('warn', '리뷰 PASS 줄 없음');
    return;
  }

  const warnings = [headMismatch(context, last.head)];
  if (last.diff !== 'none' || last.untracked !== 'none')
    warnings.push(
      `리뷰 PASS ${last.reviewId}에 commit 밖 변경이 있음: diff=${last.diff} untracked=${last.untracked}`,
    );
  for (const reason of warnings.filter(Boolean)) add('warn', reason);
  if (!warnings.some(Boolean))
    add(
      'pass',
      `리뷰 PASS ${last.reviewId}: PR head ${short(context.revisions.head)}와 같음, diff·untracked none`,
    );
}

// Judged only when the PR changes a trigger path (Owner 3.2·4.2).
function rescoreFindings(context, add) {
  const triggered = context.changedPaths.filter((path) =>
    TRIGGER_PATTERNS.some((pattern) => pattern.test(path)),
  );
  if (!triggered.length) {
    add('pass', '재채점 trigger 경로 변경 없음');
    return;
  }
  const { rescores } = context.section;
  for (const line of rescores)
    if (!line.rescore) add('warn', `형식이 틀린 재채점 줄: ${line.value}`);
  if (!rescores.length) {
    add('warn', `재채점 줄 없음: trigger 경로 ${triggered.length}개(${triggered.join(', ')})`);
    return;
  }
  for (const { value, rescore } of rescores.filter((line) => line.rescore))
    add(
      rescore.result === '실패' ? 'warn' : 'pass',
      `재채점 ${value}${rescore.result === '실패' ? ': merge 전 Owner 판단' : ''}`,
    );
}

function causeFindings(context, add) {
  const { grade, section } = context;
  if (!CAUSE_GRADES.includes(grade)) {
    add('pass', `원인 PR 판정 밖(${grade})`);
    return;
  }
  for (const line of section.causes)
    if (!line.cause) add('warn', `형식이 틀린 원인 PR 줄: ${line.value}`);
  if (!section.causes.length) add('warn', `${grade}에 원인 PR 줄 없음`);
  for (const { cause } of section.causes.filter((line) => line.cause))
    add('pass', `원인 PR ${cause.pr ? `#${cause.pr}` : `모름 — ${cause.unknown}`}`);
}

export function evaluateReviewSnapshot(context) {
  const findings = [];
  const adder = (check) => (level, reason) => findings.push({ check, level, reason });
  reviewSnapshotFindings(context, adder(REVIEW_CHECK_ID));
  rescoreFindings(context, adder(REVIEW_CHECK_ID));
  causeFindings(context, adder(CAUSE_CHECK_ID));
  return findings;
}

// The `리뷰 PASS` line of a review result: the host review id (the dispatch id without the Claude `review-dispatch-`
// prefix), the reviewed base and head, the dirty diff digest and the sha256 of the untracked inputs sorted by path, one
// `<path>\t<digest>\n` line each. Digests drop the `sha256:` prefix, so one snapshot gives one line on every host.
export function reviewPassLine(result) {
  const fail = (detail) => {
    throw new TypeError(detail);
  };
  if (result === null || typeof result !== 'object') fail('결과가 JSON 객체가 아님');
  if (result.verdict !== 'PASS') fail(`verdict가 PASS가 아님: ${result.verdict}`);
  if (typeof result.dispatchId !== 'string') fail('dispatchId 없음');
  const reviewId = result.dispatchId.startsWith(DISPATCH_PREFIX)
    ? result.dispatchId.slice(DISPATCH_PREFIX.length)
    : result.dispatchId;
  const snapshot = result.reviewedSnapshot ?? {};
  for (const field of ['baseSHA', 'headSHA'])
    if (!COMMIT.test(snapshot[field] ?? ''))
      fail(`reviewedSnapshot.${field}가 40자 commit sha가 아님`);
  const hex = (value, where) =>
    DIGEST.exec(value ?? '')?.[1] ?? fail(`${where}가 sha256 digest가 아님`);
  const diff =
    snapshot.dirtyDiffDigest === null
      ? 'none'
      : hex(snapshot.dirtyDiffDigest, 'reviewedSnapshot.dirtyDiffDigest');
  if (!Array.isArray(snapshot.untrackedInputDigests))
    fail('reviewedSnapshot.untrackedInputDigests가 배열이 아님');
  const entries = snapshot.untrackedInputDigests
    .map((entry, index) => {
      const where = `reviewedSnapshot.untrackedInputDigests[${index}]`;
      if (typeof entry?.path !== 'string' || !entry.path) fail(`${where}.path 없음`);
      return [entry.path, hex(entry.digest, `${where}.digest`)];
    })
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const untracked = entries.length
    ? createHash('sha256')
        .update(entries.map(([path, digest]) => `${path}\t${digest}\n`).join(''))
        .digest('hex')
    : 'none';
  const value = `${reviewId} base=${snapshot.baseSHA} head=${snapshot.headSHA} diff=${diff} untracked=${untracked}`;
  if (!parseReviewPass(value)) fail(`리뷰 PASS 줄 형식이 아님(reviewId ${reviewId})`);
  return `- 리뷰 PASS: ${value}`;
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: { result: { type: 'string' } },
    });
    if (!values.result) throw new TypeError('--result 없음');
    process.stdout.write(`${reviewPassLine(JSON.parse(readFileSync(values.result, 'utf8')))}\n`);
  } catch (error) {
    process.stderr.write(`review-snapshot-check: ${error.message}\n`);
    process.exitCode = 2;
  }
}
