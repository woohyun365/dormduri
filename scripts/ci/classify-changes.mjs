import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALL_PRODUCT_LANES = {
  web: true,
  api: true,
  shared: true,
  storybook: true,
  infra: true,
  repoPolicy: true,
};

const ROOT_TOOLCHAIN_PATHS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  '.node-version',
  '.nvmrc',
  '.lintstagedrc',
]);

const STORYBOOK_PATTERN =
  /(^|\/)(?:\.storybook|stories|__stories__)(\/|$)|\.stories\.[cm]?[jt]sx?$/;

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function emptyClassification() {
  return {
    web: false,
    api: false,
    shared: false,
    storybook: false,
    infra: false,
    repoPolicy: false,
  };
}

function markAll(result) {
  Object.assign(result, ALL_PRODUCT_LANES);
}

export function classifyChanges(paths) {
  const result = emptyClassification();

  if (paths.length === 0) {
    result.repoPolicy = true;
    return result;
  }

  for (const rawPath of paths) {
    const path = normalizePath(rawPath);
    let matched = false;

    if (path.startsWith('apps/web/')) {
      result.web = true;
      result.storybook ||= STORYBOOK_PATTERN.test(path);
      matched = true;
    }

    if (path.startsWith('apps/api/')) {
      result.api = true;
      matched = true;
    }

    if (path.startsWith('packages/shared/')) {
      result.shared = true;
      result.web = true;
      result.api = true;
      matched = true;
    }

    if (path.startsWith('packages/eslint-config/') || path.startsWith('packages/tsconfig/')) {
      markAll(result);
      matched = true;
    }

    if (
      path.startsWith('infra/') ||
      path.startsWith('scripts/infra/') ||
      path.startsWith('scripts/observability/')
    ) {
      result.infra = true;
      result.repoPolicy = true;
      if (
        path.startsWith('infra/db/') ||
        path.startsWith('infra/deploy/api/') ||
        path.startsWith('infra/deploy/nginx/') ||
        path === 'infra/deploy/compose.api.yml' ||
        path.startsWith('infra/deploy/scripts/')
      ) {
        result.api = true;
      }
      if (path.startsWith('infra/deploy/web/')) {
        result.web = true;
      }
      matched = true;
    }

    if (path === 'docker-compose.dev.yml' || path === '.dockerignore') {
      result.infra = true;
      result.api = true;
      result.repoPolicy = true;
      matched = true;
    }

    if (
      path.startsWith('docs/') ||
      path.startsWith('scripts/ci/') ||
      path === 'README.md' ||
      path === 'AGENTS.md' ||
      path === 'DESIGN.md'
    ) {
      result.repoPolicy = true;
      matched = true;
    }

    if (path === '.github/workflows/api-ci.yml') {
      result.api = true;
      result.repoPolicy = true;
      matched = true;
    }

    if (path === '.github/workflows/web-ci.yml') {
      result.web = true;
      result.repoPolicy = true;
      matched = true;
    }

    if (path === '.github/workflows/infra-ci.yml' || path === '.github/dependabot.yml') {
      result.infra = true;
      result.repoPolicy = true;
      matched = true;
    }

    if (path === '.github/workflows/api-restore-drill-manual.yml') {
      result.api = true;
      result.infra = true;
      result.repoPolicy = true;
      matched = true;
    }

    if ((path.startsWith('.github/') && !matched) || ROOT_TOOLCHAIN_PATHS.has(path)) {
      markAll(result);
      matched = true;
    }

    if (!matched) {
      markAll(result);
    }
  }

  return result;
}

function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value) && !/^0+$/.test(value);
}

function verifyCommit(candidate, cwd) {
  if (!candidate) {
    return null;
  }

  try {
    const resolved = runGit(['rev-parse', '--verify', `${candidate}^{commit}`], cwd);
    return isSha(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

export function eventComparisonHints({ eventName, event, githubSha }) {
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    return {
      base: event.pull_request?.base?.sha,
      head: event.pull_request?.head?.sha ?? githubSha,
      baseRef: event.pull_request?.base?.ref,
    };
  }

  if (eventName === 'push') {
    return {
      base: event.before,
      head: event.after ?? githubSha,
      baseRef: event.repository?.default_branch,
    };
  }

  return {
    base: undefined,
    head: githubSha,
    baseRef: event.repository?.default_branch,
  };
}

export function resolveComparison({ eventName, event, githubSha, cwd = process.cwd() }) {
  const hints = eventComparisonHints({ eventName, event, githubSha });
  const head = verifyCommit(hints.head, cwd) ?? verifyCommit('HEAD', cwd);

  if (!head) {
    throw new Error('변경 비교에 사용할 HEAD commit을 확인하지 못했습니다.');
  }

  const directBase = verifyCommit(hints.base, cwd);
  if (directBase && directBase !== head) {
    return { base: directBase, head, strategy: 'event-sha' };
  }

  for (const reference of [hints.baseRef ? `origin/${hints.baseRef}` : null, hints.baseRef]) {
    const verifiedReference = verifyCommit(reference, cwd);
    if (!verifiedReference || verifiedReference === head) {
      continue;
    }

    try {
      const base = runGit(['merge-base', verifiedReference, head], cwd);
      if (isSha(base) && base !== head) {
        return { base, head, strategy: 'merge-base' };
      }
    } catch {
      // Try the next bounded fallback.
    }
  }

  const parent = verifyCommit(`${head}^`, cwd);
  if (parent) {
    return { base: parent, head, strategy: 'head-parent' };
  }

  const emptyTree = runGit(['hash-object', '-t', 'tree', '/dev/null'], cwd);
  return { base: emptyTree, head, strategy: 'empty-tree' };
}

export function changedPathsForComparison(comparison, cwd = process.cwd()) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z', comparison.base, comparison.head],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

  return output.split('\0').filter(Boolean).map(normalizePath);
}

function readGithubEvent(eventPath) {
  if (!eventPath) {
    return {};
  }
  return JSON.parse(readFileSync(eventPath, 'utf8'));
}

function appendGithubOutputs(path, values) {
  const output = Object.entries(values)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
  appendFileSync(path, `${output}\n`);
}

export function summarizeChangedPaths(changedPaths, limit = 100) {
  const sample = changedPaths.slice(0, limit);
  return {
    changed_path_count: changedPaths.length,
    changed_paths_json: JSON.stringify(sample),
    changed_paths_truncated: changedPaths.length > sample.length,
  };
}

export function classifyGithubEvent({
  eventName = process.env.GITHUB_EVENT_NAME,
  eventPath = process.env.GITHUB_EVENT_PATH,
  githubSha = process.env.GITHUB_SHA,
  githubOutput = process.env.GITHUB_OUTPUT,
  cwd = process.cwd(),
} = {}) {
  let comparison = null;
  let changedPaths = [];
  let classification = ALL_PRODUCT_LANES;
  let classificationFailed = false;
  let error = null;

  try {
    const event = readGithubEvent(eventPath);
    comparison = resolveComparison({ eventName, event, githubSha, cwd });
    changedPaths = changedPathsForComparison(comparison, cwd);
    classification = classifyChanges(changedPaths);
  } catch (caught) {
    classificationFailed = true;
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const outputs = {
    ...classification,
    classification_failed: classificationFailed,
    ...summarizeChangedPaths(changedPaths),
    comparison_base: comparison?.base ?? '',
    comparison_head: comparison?.head ?? '',
    comparison_strategy: comparison?.strategy ?? 'fail-open',
  };

  if (githubOutput) {
    appendGithubOutputs(githubOutput, outputs);
  }

  return { classification, classificationFailed, changedPaths, comparison, error };
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const result = classifyGithubEvent();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
