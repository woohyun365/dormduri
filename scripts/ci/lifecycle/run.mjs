#!/usr/bin/env node
// Lifecycle gate entry (OSS-LIFE P2a, `ci.yml` job `lifecycle_gate`). Reads the pull request body through the REST API
// at run time (a re-run reads the edited body), diffs the PR from the merge-base of the event's base and head shas,
// runs the registered checks and writes every result to the job summary.
// Exit 0 = no fail, 1 = a check failed, 2 = an input could not be read (fail-closed).
//
// CI:    node scripts/ci/lifecycle/run.mjs   (GITHUB_EVENT_PATH, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY)
// Local: node scripts/ci/lifecycle/run.mjs --body-file <file> --base <rev> --head <rev> [--author <login>] [--base-ref <ref>]

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { changedPathsForComparison } from '../lanes/classify-changes.mjs';
import { parseLifecycleSection, referencedIssues } from './lifecycle-section.mjs';
import {
  ARTIFACT_MAP_FILE,
  createPathTable,
  evaluatePolicyFirst,
  LifecycleInputError,
  parseArtifactMap,
  parsePathDomains,
  PATH_DOMAINS_FILE,
} from './policy-first-check.mjs';

// Registered checks. evaluate(context) returns findings `{ check, level: 'fail' | 'warn' | 'pass', reason }`. An override
// line lowers a check's fail to a warning unless the check id is listed in nonOverridable.
export const LIFECYCLE_CHECKS = [
  { name: 'policy-first', evaluate: evaluatePolicyFirst, nonOverridable: ['L-CONFIRM'] },
];

// GitHub-assigned authors whose PRs, like PRs into main, only warn (Owner 2026-10-16 P2a 2.4).
export const EXEMPT_AUTHORS = ['renovate[bot]', 'dependabot[bot]'];

// Context every registered check receives. reader: { readFile(revision, path) → text | null, listFiles(revision) }.
export function buildLifecycleContext({ body, author, baseRef, revisions, changedPaths, reader }) {
  const section = parseLifecycleSection(body ?? '');
  const pathDomainsText = reader.readFile(revisions.head, PATH_DOMAINS_FILE);
  if (pathDomainsText === null) throw new LifecycleInputError(`${PATH_DOMAINS_FILE}가 head에 없음`);
  const pathDomains = parsePathDomains(pathDomainsText);
  const pathTable = createPathTable(pathDomains);
  const artifactMapText = reader.readFile(revisions.head, ARTIFACT_MAP_FILE);
  return {
    section,
    grade: section.grade.effective,
    overrides: section.overrides,
    issueRefs: referencedIssues(body ?? ''),
    author,
    baseRef,
    revisions,
    changedPaths,
    readFile: reader.readFile,
    headFiles: reader.listFiles(revisions.head),
    pathDomains,
    pathTable,
    isProductPath: pathTable.isProductPath,
    artifactMap: artifactMapText === null ? null : parseArtifactMap(artifactMapText),
  };
}

export function evaluateLifecycle(context, checks = LIFECYCLE_CHECKS) {
  const nonOverridable = new Set(checks.flatMap((check) => check.nonOverridable ?? []));
  const findings = context.section.warnings.map((reason) => ({
    check: '(형식)',
    level: 'warn',
    reason,
  }));
  for (const override of context.overrides)
    if (nonOverridable.has(override.check))
      findings.push({
        check: '(형식)',
        level: 'warn',
        reason: `override 대상이 아닌 검사: ${override.check}`,
      });

  for (const check of checks)
    for (const finding of check.evaluate(context)) {
      const override =
        finding.level === 'fail' &&
        !nonOverridable.has(finding.check) &&
        context.overrides.find((line) => line.check === finding.check);
      findings.push(
        override
          ? {
              ...finding,
              level: 'warn',
              reason: `${finding.reason} — override: ${override.reason} — 재검토: ${override.revisit}`,
            }
          : finding,
      );
    }

  const exemption = EXEMPT_AUTHORS.includes(context.author)
    ? `author ${context.author}`
    : context.baseRef === 'main'
      ? 'base main'
      : null;
  const final = exemption
    ? findings.map((finding) =>
        finding.level === 'fail'
          ? { ...finding, level: 'warn', reason: `${finding.reason} (경고로 낮춤: ${exemption})` }
          : finding,
      )
    : findings;
  return {
    findings: final,
    failed: final.some((finding) => finding.level === 'fail'),
    downgrade: exemption ? `모든 fail을 경고로 낮춤: ${exemption}` : null,
  };
}

const cell = (text) => String(text).replace(/\r?\n/gu, ' ').replace(/\|/gu, '\\|');
const short = (sha) => (sha ? sha.slice(0, 12) : '-');

export function renderSummary({ meta, evaluation }) {
  const count = (level) => evaluation.findings.filter((finding) => finding.level === level).length;
  const { revisions } = meta;
  return [
    '### Lifecycle gate',
    '',
    `- PR ${meta.number ? `#${meta.number}` : '(local)'}, author \`${meta.author}\`, base \`${meta.baseRef}\` \`${short(revisions.base)}\`, head \`${short(revisions.head)}\`, merge-base \`${short(revisions.mergeBase)}\``,
    `- 변경 등급: 선언 \`${meta.grade.declared ?? '없음'}\`, 계산 \`${meta.grade.effective}\``,
    `- 변경 경로 ${meta.changedPaths.length}개`,
    ...(evaluation.downgrade ? [`- ${evaluation.downgrade}`] : []),
    `- 결과: fail ${count('fail')}, 경고 ${count('warn')}, 통과 ${count('pass')}`,
    '',
    '| 검사 | 결과 | 이유 |',
    '| --- | --- | --- |',
    ...evaluation.findings.map(
      (finding) => `| ${cell(finding.check)} | ${finding.level} | ${cell(finding.reason)} |`,
    ),
    '',
  ].join('\n');
}

const renderFailure = (message) =>
  ['### Lifecycle gate', '', `- job 실패: ${cell(message)}`, ''].join('\n');

const gitMessage = (error) =>
  String(error.stderr || error.message)
    .trim()
    .split('\n')[0];

export function createGitReader(cwd) {
  const git = (args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return {
    commit: (revision) => git(['rev-parse', '--verify', `${revision}^{commit}`]).trim(),
    mergeBase: (left, right) => git(['merge-base', left, right]).trim(),
    readFile(revision, path) {
      const entry = git(['ls-tree', '-z', revision, '--', path]).split('\0')[0];
      if (!entry || entry.split(/\s/u)[1] !== 'blob') return null;
      return git(['cat-file', 'blob', `${revision}:${path}`]);
    },
    listFiles: (revision) =>
      git(['ls-tree', '-r', '-z', '--name-only', revision]).split('\0').filter(Boolean),
  };
}

function localInput(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'body-file': { type: 'string' },
      base: { type: 'string' },
      head: { type: 'string' },
      author: { type: 'string', default: 'local' },
      'base-ref': { type: 'string', default: 'dev' },
    },
  });
  for (const option of ['body-file', 'base', 'head'])
    if (!values[option]) throw new LifecycleInputError(`--${option} 없음`);
  return {
    number: null,
    body: readFileSync(values['body-file'], 'utf8'),
    base: values.base,
    head: values.head,
    author: values.author,
    baseRef: values['base-ref'],
  };
}

async function pullRequestInput({ env, fetchImpl }) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request')
    throw new LifecycleInputError(`pull_request event가 아님: ${env.GITHUB_EVENT_NAME ?? '없음'}`);
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const pullRequest = event.pull_request ?? {};
  const { number } = pullRequest;
  const base = pullRequest.base?.sha;
  const head = pullRequest.head?.sha;
  if (!Number.isInteger(number) || !base || !head)
    throw new LifecycleInputError('event payload에 pull_request number·base.sha·head.sha가 없음');
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY)
    throw new LifecycleInputError('GITHUB_TOKEN 또는 GITHUB_REPOSITORY가 없음');

  const url = `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}/pulls/${number}`;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new LifecycleInputError(`PR 본문을 읽지 못함: ${error.message}`);
  }
  if (!response.ok) throw new LifecycleInputError(`PR 본문을 읽지 못함: HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.user?.login !== 'string' || typeof data.base?.ref !== 'string')
    throw new LifecycleInputError('PR 응답에 user.login·base.ref가 없음');
  return {
    number,
    body: data.body ?? '',
    base,
    head,
    author: data.user.login,
    baseRef: data.base.ref,
  };
}

export async function runLifecycleGate({
  env = process.env,
  cwd = process.cwd(),
  fetchImpl = globalThis.fetch,
  argv = [],
} = {}) {
  const local = argv.length > 0;
  let result;
  try {
    const input = local ? localInput(argv) : await pullRequestInput({ env, fetchImpl });
    const reader = createGitReader(cwd);
    let revisions;
    try {
      const base = reader.commit(input.base);
      const head = reader.commit(input.head);
      revisions = { base, head, mergeBase: reader.mergeBase(base, head) };
    } catch (error) {
      throw new LifecycleInputError(
        `merge-base 계산 실패(base ${input.base}, head ${input.head}): ${gitMessage(error)}`,
      );
    }
    const changedPaths = changedPathsForComparison(
      { base: revisions.mergeBase, head: revisions.head },
      cwd,
    );
    const context = buildLifecycleContext({ ...input, revisions, changedPaths, reader });
    const evaluation = evaluateLifecycle(context);
    result = {
      exitCode: evaluation.failed ? 1 : 0,
      summary: renderSummary({
        meta: { ...input, revisions, changedPaths, grade: context.section.grade },
        evaluation,
      }),
    };
  } catch (error) {
    if (!(error instanceof LifecycleInputError)) process.stderr.write(`${error.stack}\n`);
    result = { exitCode: 2, summary: renderFailure(error.message) };
  }
  if (!local && env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, result.summary);
  return result;
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const { exitCode, summary } = await runLifecycleGate({ argv: process.argv.slice(2) });
  process.stdout.write(summary);
  if (exitCode === 1)
    process.stderr.write('::error::Lifecycle gate: 검사 fail. job summary를 본다.\n');
  if (exitCode === 2)
    process.stderr.write('::error::Lifecycle gate: 입력을 읽지 못해 job을 실패시킨다.\n');
  process.exitCode = exitCode;
}
