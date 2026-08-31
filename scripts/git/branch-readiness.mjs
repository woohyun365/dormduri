#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifyChanges } from '../ci/classify-changes.mjs';

const RECOMMENDATIONS = new Set(['cohesive', 'scope-audit-required', 'stop-and-split']);
const DISPOSITIONS = [
  'requiredCurrent',
  'prerequisitePredecessor',
  'independentFollowUp',
  'unrelatedOrSpeculative',
];
const LOCKFILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'composer.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);
const GENERATED_PATH_PATTERNS = [
  /(^|\/)generated(\/|$)/u,
  /(^|\/)__generated__(\/|$)/u,
  /\.generated\.[^/]+$/u,
  /(^|\/)coverage(\/|$)/u,
];

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function runGit(args, cwd, { trim = true } = {}) {
  const output = execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return trim ? output.trim() : output;
}

function verifyCommit(reference, cwd) {
  try {
    return runGit(['rev-parse', '--verify', `${reference}^{commit}`], cwd);
  } catch {
    return null;
  }
}

function splitZeroTerminated(value) {
  return value.split('\0').filter(Boolean).map(normalizePath);
}

function unique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function normalizeDispositionItem(item) {
  if (typeof item === 'string') return { summary: item.trim(), issue: '' };
  return {
    summary: asString(item?.summary),
    issue: asString(item?.issue),
  };
}

export function normalizeDeclaration(input = {}) {
  const ownerDisposition = {};
  for (const disposition of DISPOSITIONS) {
    const items = Array.isArray(input.ownerDisposition?.[disposition])
      ? input.ownerDisposition[disposition]
      : [];
    ownerDisposition[disposition] = items
      .map(normalizeDispositionItem)
      .filter((item) => item.summary);
  }

  return {
    issue: asString(input.issue),
    plan: asString(input.plan),
    outcome: asString(input.outcome),
    acceptance: asStringArray(input.acceptance),
    nonScope: asStringArray(input.nonScope),
    doNotTouch: asStringArray(input.doNotTouch).map(normalizePath),
    ownerDisposition,
    blockers: asObjectArray(input.blockers).map((blocker) => ({
      summary: asString(blocker.summary),
      unblockEvidence: asString(blocker.unblockEvidence),
      revisitTrigger: asString(blocker.revisitTrigger),
    })),
    semantic: {
      independentOutcomes: Math.max(
        0,
        Math.trunc(Number(input.semantic?.independentOutcomes) || 0),
      ),
      sharedAcceptanceAcrossLanes: input.semantic?.sharedAcceptanceAcrossLanes === true,
      refactorPlusUnrelatedBehavior: input.semantic?.refactorPlusUnrelatedBehavior === true,
      acceptanceDependsOnUnmergedWork: input.semantic?.acceptanceDependsOnUnmergedWork === true,
      unownedScopeDrift: input.semantic?.unownedScopeDrift === true,
      boundaryConflicts: asStringArray(input.semantic?.boundaryConflicts),
      mechanicalChange: asString(input.semantic?.mechanicalChange),
      behaviorEvidence: asStringArray(input.semantic?.behaviorEvidence),
    },
  };
}

function isLockfile(path) {
  return LOCKFILE_NAMES.has(path.split('/').at(-1));
}

function isGenerated(path) {
  return GENERATED_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function countUntrackedLines(path, cwd) {
  try {
    const content = readFileSync(resolve(cwd, path));
    if (content.includes(0)) return { additions: null, deletions: null, binary: true };
    if (content.length === 0) return { additions: 0, deletions: 0, binary: false };
    const text = content.toString('utf8');
    return {
      additions: text.split('\n').length - (text.endsWith('\n') ? 1 : 0),
      deletions: 0,
      binary: false,
    };
  } catch {
    return { additions: null, deletions: null, binary: true };
  }
}

function parseNumstat(base, cwd) {
  const output = runGit(['diff', '--numstat', '--no-renames', base, '--'], cwd, { trim: false });
  if (!output) return [];

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added, deleted, ...pathParts] = line.split('\t');
      const binary = added === '-' || deleted === '-';
      return {
        path: normalizePath(pathParts.join('\t')),
        additions: binary ? null : Number(added),
        deletions: binary ? null : Number(deleted),
        binary,
      };
    });
}

function summarizeStats(records, paths) {
  const pathSet = new Set(paths);
  const selected = records.filter((record) => pathSet.has(record.path));
  const meaningful = selected.filter(
    (record) => !isLockfile(record.path) && !isGenerated(record.path),
  );
  const sum = (items, key) =>
    items.reduce((total, item) => total + (typeof item[key] === 'number' ? item[key] : 0), 0);

  const additions = sum(selected, 'additions');
  const deletions = sum(selected, 'deletions');
  return {
    additions,
    deletions,
    meaningfulAdditions: sum(meaningful, 'additions'),
    meaningfulDeletions: sum(meaningful, 'deletions'),
    binaryPathCount: selected.filter((record) => record.binary).length,
    deletionsOutnumberAdditions: deletions > additions,
  };
}

function classifyNoise(paths) {
  return {
    lockfilePaths: paths.filter(isLockfile),
    generatedPaths: paths.filter(isGenerated),
    lockfileOnly: paths.length > 0 && paths.every(isLockfile),
    generatedOnly: paths.length > 0 && paths.every(isGenerated),
  };
}

export function collectBranchEvidence({ base, declaration = {}, cwd = process.cwd() }) {
  if (!base) {
    throw new Error('`--base`가 필요합니다. 예: `--base origin/dev`');
  }

  const verifiedBase = verifyCommit(base, cwd);
  if (!verifiedBase) {
    throw new Error(
      `기준 branch '${base}'를 commit으로 확인하지 못했습니다. ` +
        '`git fetch origin dev` 후 remote base를 다시 지정해 주세요.',
    );
  }

  const head = verifyCommit('HEAD', cwd);
  if (!head) throw new Error('현재 HEAD commit을 확인하지 못했습니다.');

  const mergeBase = runGit(['merge-base', verifiedBase, head], cwd);
  const committedPaths = splitZeroTerminated(
    runGit(['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z', mergeBase, head, '--'], cwd, {
      trim: false,
    }),
  );
  const workingTrackedPaths = splitZeroTerminated(
    runGit(['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z', head, '--'], cwd, {
      trim: false,
    }),
  );
  const untrackedPaths = splitZeroTerminated(
    runGit(['ls-files', '--others', '--exclude-standard', '-z'], cwd, { trim: false }),
  );
  const normalizedDeclaration = normalizeDeclaration(declaration);
  const doNotTouch = new Set(normalizedDeclaration.doNotTouch);
  const committedPathSet = new Set(committedPaths);
  const allPaths = unique([...committedPaths, ...workingTrackedPaths, ...untrackedPaths]);
  const doNotTouchConflicts = committedPaths.filter((path) => doNotTouch.has(path));
  const excludedDoNotTouch = allPaths.filter(
    (path) => doNotTouch.has(path) && !committedPathSet.has(path),
  );
  const changedPaths = allPaths.filter(
    (path) => !doNotTouch.has(path) || committedPathSet.has(path),
  );

  const records = parseNumstat(mergeBase, cwd);
  const recordedPaths = new Set(records.map((record) => record.path));
  for (const path of untrackedPaths) {
    if (!doNotTouch.has(path) && !recordedPaths.has(path)) {
      records.push({ path, ...countUntrackedLines(path, cwd) });
    }
  }

  const classification = classifyChanges(changedPaths);
  const selectedLanes = Object.entries(classification)
    .filter(([, selected]) => selected)
    .map(([lane]) => lane);
  const status = runGit(['status', '--porcelain=v2', '-z'], cwd, { trim: false });

  return {
    comparison: {
      requestedBase: base,
      verifiedBase,
      mergeBase,
      head,
      commitCountContext: Number(runGit(['rev-list', '--count', `${mergeBase}..${head}`], cwd)),
    },
    workingTree: {
      dirty: status.length > 0,
      untrackedPaths,
      excludedDoNotTouch,
      doNotTouchConflicts,
    },
    changedPaths,
    stats: summarizeStats(records, changedPaths),
    noise: classifyNoise(changedPaths),
    classification,
    selectedLanes,
  };
}

function finding(code, message) {
  return { code, message };
}

export function assessBranchReadiness({ evidence, declaration = {} }) {
  const normalized = normalizeDeclaration(declaration);
  const policyErrors = [];
  const stopReasons = [];
  const auditReasons = [];

  for (const blocker of normalized.blockers) {
    if (!blocker.summary || !blocker.unblockEvidence || !blocker.revisitTrigger) {
      policyErrors.push(
        finding(
          'BLOCKER_EVIDENCE_INCOMPLETE',
          'Blocker에는 summary, unblockEvidence, revisitTrigger가 모두 필요합니다.',
        ),
      );
    }
  }

  for (const followUp of normalized.ownerDisposition.independentFollowUp) {
    if (!/^#[1-9]\d*$/u.test(followUp.issue)) {
      policyErrors.push(
        finding(
          'FOLLOW_UP_ISSUE_MISSING',
          'independent-follow-up은 `#123` 형식의 linked Issue를 가져야 합니다.',
        ),
      );
    }
  }

  if (!normalized.outcome) {
    auditReasons.push(finding('OUTCOME_UNDECLARED', 'Prospective outcome이 선언되지 않았습니다.'));
  }
  if (normalized.acceptance.length === 0) {
    auditReasons.push(
      finding('ACCEPTANCE_UNDECLARED', 'Acceptance evidence가 선언되지 않았습니다.'),
    );
  }
  if (normalized.nonScope.length === 0) {
    auditReasons.push(finding('NON_SCOPE_UNDECLARED', 'Non-scope가 선언되지 않았습니다.'));
  }
  if ((evidence?.changedPaths ?? []).length === 0) {
    auditReasons.push(
      finding('NO_EVALUATED_CHANGES', '현재 branch에서 평가할 변경을 찾지 못했습니다.'),
    );
  }
  if ((evidence?.workingTree?.doNotTouchConflicts ?? []).length > 0) {
    auditReasons.push(
      finding(
        'COMMITTED_DO_NOT_TOUCH_CONFLICT',
        `이미 commit된 doNotTouch path는 숨길 수 없습니다: ${evidence.workingTree.doNotTouchConflicts.join(', ')}`,
      ),
    );
  }

  if (normalized.semantic.independentOutcomes > 1) {
    stopReasons.push(
      finding('INDEPENDENT_OUTCOMES', '독립적으로 review 가능한 outcome이 둘 이상 선언되었습니다.'),
    );
  }
  if (normalized.ownerDisposition.prerequisitePredecessor.length > 0) {
    stopReasons.push(
      finding(
        'PREDECESSOR_REQUIRED',
        '현재 acceptance보다 먼저 병합할 predecessor가 선언되었습니다.',
      ),
    );
  }
  if (normalized.semantic.boundaryConflicts.length > 0) {
    stopReasons.push(
      finding(
        'INCOMPATIBLE_BOUNDARIES',
        `독립 rollback/migration/security/release boundary: ${normalized.semantic.boundaryConflicts.join(', ')}`,
      ),
    );
  }
  if (normalized.semantic.refactorPlusUnrelatedBehavior) {
    stopReasons.push(
      finding(
        'REFACTOR_WITH_UNRELATED_BEHAVIOR',
        'Refactor와 독립 behavior change가 같은 branch에 있습니다.',
      ),
    );
  }
  if (normalized.semantic.acceptanceDependsOnUnmergedWork) {
    stopReasons.push(
      finding(
        'UNMERGED_ACCEPTANCE_DEPENDENCY',
        'Acceptance가 아직 병합되지 않은 독립 작업에 의존합니다.',
      ),
    );
  }

  const selectedProductLanes = (evidence?.selectedLanes ?? []).filter(
    (lane) => lane !== 'repoPolicy' && lane !== 'storybook',
  );
  if (selectedProductLanes.length > 1 && !normalized.semantic.sharedAcceptanceAcrossLanes) {
    auditReasons.push(
      finding(
        'MULTI_LANE_ACCEPTANCE_REVIEW',
        `여러 CI lane(${selectedProductLanes.join(', ')})이 선택되어 shared acceptance 확인이 필요합니다.`,
      ),
    );
  }
  if (normalized.semantic.unownedScopeDrift) {
    auditReasons.push(
      finding(
        'UNOWNED_SCOPE_DRIFT',
        'Owner disposition이 정해지지 않은 scope drift가 선언되었습니다.',
      ),
    );
  }
  if (
    normalized.semantic.mechanicalChange === 'verified-codemod' &&
    normalized.semantic.behaviorEvidence.length === 0
  ) {
    auditReasons.push(
      finding(
        'CODEMOD_EVIDENCE_MISSING',
        'Verified codemod 예외에는 behavior evidence가 필요합니다.',
      ),
    );
  }

  let recommendation = 'cohesive';
  let decisionSource = 'deterministic';
  let reasons = [];

  if (policyErrors.length > 0 || stopReasons.length > 0) {
    recommendation = 'stop-and-split';
    reasons = [...policyErrors, ...stopReasons];
  } else if (auditReasons.length > 0) {
    recommendation = 'scope-audit-required';
    decisionSource = 'model-mediated';
    reasons = auditReasons;
  } else {
    reasons = [
      finding(
        'DECLARED_ACCEPTANCE_COHESIVE',
        '선언된 outcome, acceptance, owner disposition에서 분리 신호를 찾지 못했습니다.',
      ),
    ];
  }

  if (!RECOMMENDATIONS.has(recommendation)) {
    throw new Error(`지원하지 않는 recommendation: ${recommendation}`);
  }

  return {
    valid: policyErrors.length === 0,
    recommendation,
    decisionSource,
    reasons,
    policyErrors,
    declaration: normalized,
  };
}

export function createBranchReadinessReport({ base, declaration, cwd = process.cwd() }) {
  const evidence = collectBranchEvidence({ base, declaration, cwd });
  const assessment = assessBranchReadiness({ evidence, declaration });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    advisory: true,
    evidence,
    assessment,
  };
}

function parseFollowUp(value) {
  const match = /^(#[1-9]\d*):\s*(.+)$/u.exec(value);
  return match ? { issue: match[1], summary: match[2] } : { issue: '', summary: value };
}

function parseArgs(argv) {
  const options = {
    base: '',
    input: '',
    json: false,
    declaration: {
      acceptance: [],
      nonScope: [],
      doNotTouch: [],
      ownerDisposition: { independentFollowUp: [] },
    },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} 뒤에 값이 필요합니다.`);
    index += 1;
    if (argument === '--base') options.base = value;
    else if (argument === '--input') options.input = value;
    else if (argument === '--issue') options.declaration.issue = value;
    else if (argument === '--plan') options.declaration.plan = value;
    else if (argument === '--outcome') options.declaration.outcome = value;
    else if (argument === '--acceptance') options.declaration.acceptance.push(value);
    else if (argument === '--non-scope') options.declaration.nonScope.push(value);
    else if (argument === '--do-not-touch') options.declaration.doNotTouch.push(value);
    else if (argument === '--follow-up') {
      options.declaration.ownerDisposition.independentFollowUp.push(parseFollowUp(value));
    } else throw new Error(`지원하지 않는 option: ${argument}`);
  }

  return options;
}

function mergeDeclarations(fromFile, fromCli) {
  const merged = structuredClone(fromFile ?? {});
  for (const key of ['issue', 'plan', 'outcome']) {
    if (fromCli[key]) merged[key] = fromCli[key];
  }
  for (const key of ['acceptance', 'nonScope', 'doNotTouch']) {
    merged[key] = [...(merged[key] ?? []), ...(fromCli[key] ?? [])];
  }
  merged.ownerDisposition = {
    ...(merged.ownerDisposition ?? {}),
    independentFollowUp: [
      ...(merged.ownerDisposition?.independentFollowUp ?? []),
      ...(fromCli.ownerDisposition?.independentFollowUp ?? []),
    ],
  };
  return merged;
}

function renderHuman(report) {
  const { evidence, assessment } = report;
  const lines = [
    `Branch readiness: ${assessment.recommendation} (${assessment.decisionSource})`,
    `Base: ${evidence.comparison.requestedBase} -> ${evidence.comparison.mergeBase}`,
    `Head: ${evidence.comparison.head}`,
    `Changed paths: ${evidence.changedPaths.length}`,
    `Meaningful lines: +${evidence.stats.meaningfulAdditions} / -${evidence.stats.meaningfulDeletions}`,
    `Selected CI lanes: ${evidence.selectedLanes.join(', ') || 'none'}`,
    `Noise: lockfileOnly=${evidence.noise.lockfileOnly}, generatedOnly=${evidence.noise.generatedOnly}, deletionsOutnumberAdditions=${evidence.stats.deletionsOutnumberAdditions}`,
  ];
  if (evidence.workingTree.excludedDoNotTouch.length > 0) {
    lines.push(`Excluded doNotTouch: ${evidence.workingTree.excludedDoNotTouch.join(', ')}`);
  }
  lines.push('Reasons:');
  for (const reason of assessment.reasons) lines.push(`- ${reason.code}: ${reason.message}`);
  lines.push('This command is advisory; semantic split decisions remain with the branch owner.');
  return `${lines.join('\n')}\n`;
}

function usage() {
  return `Usage:
  pnpm git:branch-readiness -- --base origin/dev [--input declaration.json] [--json]

Common declaration flags:
  --issue "#123" --plan "path" --outcome "..."
  --acceptance "..." --non-scope "..." --follow-up "#456: summary"
  --do-not-touch "DESIGN.md"
`;
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      process.stdout.write(usage());
      return 0;
    }
    const fileDeclaration = options.input
      ? JSON.parse(readFileSync(resolve(options.input), 'utf8'))
      : {};
    const declaration = mergeDeclarations(fileDeclaration, options.declaration);
    const report = createBranchReadinessReport({ base: options.base, declaration });
    process.stdout.write(
      options.json ? `${JSON.stringify(report, null, 2)}\n` : renderHuman(report),
    );
    return report.assessment.valid ? 0 : 2;
  } catch (error) {
    process.stderr.write(
      `branch readiness failed: ${error instanceof Error ? error.message : error}\n`,
    );
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) process.exitCode = main();
