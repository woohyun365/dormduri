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
  agentWorkflow: true,
};

const ROOT_TOOLCHAIN_PATHS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.node-version',
  '.lintstagedrc.mjs',
]);

// Paths that change every lane's inputs. Any other path that selects every lane is a classification gap
// (scripts/ci/lanes/classify-changes.test.mjs checks the tracked tree against this list).
const INTENDED_FAN_OUT_PREFIXES = ['packages/eslint-config/', 'packages/tsconfig/'];
const INTENDED_FAN_OUT_PATHS = new Set([...ROOT_TOOLCHAIN_PATHS, '.github/workflows/ci.yml']);

export function isIntendedFanOut(rawPath) {
  const path = normalizePath(rawPath);
  return (
    INTENDED_FAN_OUT_PATHS.has(path) ||
    INTENDED_FAN_OUT_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

const STORYBOOK_PATTERN =
  /(^|\/)(?:\.storybook|stories|__stories__)(\/|$)|\.stories\.[cm]?[jt]sx?$/;
// Repository scripts that lane jobs run or import (workflow steps, pnpm scripts, the web image build) or that files
// of a lane package import or read. A change re-runs those lanes; classify-changes.test.mjs derives the set from the
// workflows, package scripts, package files and imports.
const LANE_SCRIPT_PATHS = new Map([
  ['scripts/artifacts/paths.mjs', ['api']],
  ['scripts/ci/product/prepare-next-standalone.mjs', ['web']],
  ['scripts/ci/lanes/repo-policy-test-files.mjs', ['infra']],
  ['scripts/ci/lanes/run-timed-command.mjs', ['web', 'api', 'storybook']],
  ['scripts/infra/compose/profile.mjs', ['api']],
  ['scripts/observability/production/environment.mjs', ['api']],
  ['scripts/observability/rehearsal/web-bff.mjs', ['api']],
  ['scripts/observability/sentry/check-build.mjs', ['web']],
]);

// Product files that agent workflow tests read (measured by tracing the agent suite's file reads). A change to one
// re-runs the agent workflow lane next to its product lane. classify-changes.test.mjs checks that every product file
// the agent tests or their fixtures name, or that a development document links, is listed here.
export const AGENT_TEST_PRODUCT_INPUTS = {
  files: [
    'apps/api/src/auth/auth.module.ts',
    'apps/api/src/legal/contracts/legal-public-api.spec.ts',
    'apps/api/src/legal/legal.controller.ts',
    'apps/web/.storybook/preview.tsx',
    'apps/web/e2e/legal.spec.ts',
    'apps/web/playwright.config.ts',
    'apps/web/src/app/api/legal/documents/[kind]/route.ts',
    'apps/web/src/app/api/legal/documents/active-bundle/route.ts',
    'apps/web/src/app/globals.css',
    'apps/web/src/app/layout.tsx',
    'apps/web/src/auth/model/__tests__/authSharedValidation.contract.test.ts',
    'apps/web/src/components/ui/Button.tsx',
    'apps/web/src/components/ui/Chip.tsx',
    'apps/web/src/legal/README.md',
    'apps/web/src/legal/__tests__/legal-document-pages.test.tsx',
    'apps/web/src/legal/api/legal-document.mapper.ts',
    'apps/web/src/legal/components/LegalDocumentActions.tsx',
    'apps/web/src/legal/components/LegalDocumentBackButton.tsx',
    'apps/web/src/legal/components/LegalDocumentLayout.tsx',
    'apps/web/src/legal/components/LegalDocumentUnavailable.tsx',
    'apps/web/src/legal/content/legal-copy.ts',
    'apps/web/src/legal/content/legal-fallback-documents.ts',
    'apps/web/src/main/README.md',
    'apps/web/src/main/hooks/__tests__/useMainProfileState.dom.test.ts',
    'apps/web/src/main/hooks/useMainProfileState.ts',
    'apps/web/src/main/model/mainRoutes.ts',
    'apps/web/src/main/routes/HomeRoute.tsx',
    'apps/web/src/main/routes/ProfileRoute.tsx',
    'apps/web/src/main/runtime/MainRuntime.test.tsx',
    'apps/web/src/main/tabs/home/__tests__/HomeDashboardLayout.test.tsx',
    'apps/web/src/main/tabs/home/__tests__/HomeResponsiveOverlay.test.tsx',
    'apps/web/src/main/tabs/home/overlays/HomeResponsiveDialog.tsx',
    'apps/web/src/main/tabs/home/sections/primary/PrimaryWithdrawalSheet.tsx',
    'apps/web/src/main/tabs/profile/ProfileCompatibility.tsx',
    'apps/web/src/main/tabs/roommate-list/components/__tests__/RoommateSummaryCard.test.tsx',
    'apps/web/src/styles/knu.css',
    'packages/shared/src/legal/contract.ts',
  ],
  prefixes: ['apps/web/src/main/tabs/home/sections/activity/dialogs/'],
};

function isAgentTestProductInput(path) {
  return (
    AGENT_TEST_PRODUCT_INPUTS.files.includes(path) ||
    AGENT_TEST_PRODUCT_INPUTS.prefixes.some((prefix) => path.startsWith(prefix))
  );
}

// Surfaces checked by the repo-policy lane only. Agent workflow paths (host configuration, agent
// scripts, tests and instructions) and repository support files never select product lanes.
const REPO_POLICY_PREFIXES = [
  'docs/',
  'scripts/agents/',
  'scripts/ci/',
  'scripts/dependencies/',
  'scripts/git/',
  'scripts/github/',
  'scripts/security/',
  '.agents/',
  '.claude/',
  '.codex/',
  '.github/ISSUE_TEMPLATE/',
  '.husky/',
  '.vscode/',
  '.artifacts/',
  '.plans/',
  'omx_wiki/',
];
const REPO_POLICY_PATHS = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'README.md',
  'SERVICE.md',
  'renovate.json',
  'scripts/README.md',
  '.editorconfig',
  '.gitignore',
  '.omc-workspace',
  '.omx-config.json',
  '.prettierignore',
  '.prettierrc',
]);

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
    agentWorkflow: false,
  };
}

function markAll(result) {
  Object.assign(result, ALL_PRODUCT_LANES);
}

export function classifyChanges(paths) {
  const result = emptyClassification();

  if (paths.length === 0) {
    result.repoPolicy = true;
    result.agentWorkflow = true;
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

    if (isIntendedFanOut(path)) {
      markAll(result);
      matched = true;
    }

    if (
      path.startsWith('infra/') ||
      path.startsWith('scripts/artifacts/') ||
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

    for (const lane of LANE_SCRIPT_PATHS.get(path) ?? []) {
      result[lane] = true;
      result.repoPolicy = true;
      matched = true;
    }

    if (path === 'docker-compose.dev.yml' || path === '.dockerignore') {
      result.infra = true;
      result.api = true;
      result.repoPolicy = true;
      matched = true;
    }

    if (
      REPO_POLICY_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
      REPO_POLICY_PATHS.has(path) ||
      (path.startsWith('.github/') && path.endsWith('.md'))
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

    if (path.startsWith('.github/') && !matched) {
      markAll(result);
      matched = true;
    }

    if (!matched) {
      markAll(result);
    }

    if (isAgentTestProductInput(path)) {
      result.agentWorkflow = true;
    }
  }

  // Agent workflow tests read the agent surface, documentation and repository support files, the same inputs that
  // select the repo-policy lane, so every repo-policy change also runs them.
  result.agentWorkflow ||= result.repoPolicy;
  return result;
}

// Files that change how Prettier formats or which files it checks, matched at any depth: Prettier and EditorConfig
// resolve configuration upward from each file, Prettier reads .gitignore and .prettierignore by default, Git applies
// .gitattributes (line endings) to every checked-out file, package.json may carry a `prettier` key, and the lockfile
// and workspace catalog pin the Prettier version. A change to any of them re-checks the whole tree.
const FORMATTING_CONFIG_PATTERN =
  /(?:^|\/)(?:\.prettierrc(?:\.[^/]+)?|prettier\.config\.[cm]?[jt]s|\.prettierignore|\.gitignore|\.gitattributes|\.editorconfig|package\.json|package\.yaml|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/u;
// Above this many changed paths a full check costs about the same and keeps the job output small.
export const FORMATTING_CHANGED_PATH_LIMIT = 500;

// A path no lane rule knows may be a new formatting input (a Prettier plugin, a checkout attribute file), so it keeps
// the full check just as it keeps every lane.
function isUnknownPath(path) {
  return !isIntendedFanOut(path) && Object.values(classifyChanges([path])).every(Boolean);
}

export function formattingScope(paths) {
  if (paths.length === 0 || paths.length > FORMATTING_CHANGED_PATH_LIMIT) {
    return 'full';
  }
  return paths.some((rawPath) => {
    const path = normalizePath(rawPath);
    return FORMATTING_CONFIG_PATTERN.test(path) || isUnknownPath(path);
  })
    ? 'full'
    : 'changed';
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

// --no-renames lists a rename as its deleted source and added destination, so both paths select their lanes
// regardless of the diff.renames setting.
export function changedPathsForComparison(comparison, cwd = process.cwd()) {
  const output = execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      '--no-renames',
      '--diff-filter=ACDMRTUXB',
      '-z',
      comparison.base,
      comparison.head,
    ],
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

  // Only a change list measured against the PR base or the pushed range can narrow the formatting check; a failure
  // or a fallback comparison (head parent, empty tree) keeps the full check.
  const precise =
    !classificationFailed && ['event-sha', 'merge-base'].includes(comparison?.strategy);
  const formatting = precise ? formattingScope(changedPaths) : 'full';
  const outputs = {
    ...classification,
    classification_failed: classificationFailed,
    formatting_scope: formatting,
    formatting_paths_json: JSON.stringify(formatting === 'changed' ? changedPaths : []),
    ...summarizeChangedPaths(changedPaths),
    comparison_base: comparison?.base ?? '',
    comparison_head: comparison?.head ?? '',
    comparison_strategy: comparison?.strategy ?? 'fail-open',
  };

  if (githubOutput) {
    appendGithubOutputs(githubOutput, outputs);
  }

  return {
    classification,
    classificationFailed,
    changedPaths,
    comparison,
    formattingScope: formatting,
    error,
  };
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const result = classifyGithubEvent();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
