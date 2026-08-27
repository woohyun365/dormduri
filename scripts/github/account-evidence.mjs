#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveArtifactPath, resolveArtifactsDirectory } from '../artifacts/paths.mjs';
import { buildResourceInventory } from '../ci/github-actions-resource-inventory.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const policyPath = resolve(import.meta.dirname, 'fixtures/account-evidence-policy.json');
const billingItemFields = [
  'date',
  'discountAmount',
  'grossAmount',
  'netAmount',
  'pricePerUnit',
  'product',
  'quantity',
  'repositoryName',
  'sku',
  'unitType',
];
const billingJq = `{usageItems: [.usageItems[] | {${billingItemFields.join(', ')}}]}`;
const credentialPattern = /(?:github_pat_|gh[opusr]_[A-Za-z0-9_]{12,})/u;

class AccountEvidenceError extends Error {
  constructor(code, message, ownerAction, retryable = false) {
    super(`${code}: ${message}`);
    this.code = code;
    this.ownerAction = ownerAction;
    this.retryable = retryable;
  }
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertExactKeys(value, expectedKeys, name) {
  const unknown = Object.keys(value).filter((key) => !expectedKeys.includes(key));
  if (unknown.length > 0) throw new TypeError(`unknown ${name} field: ${unknown.join(', ')}`);
}

export function parseAccountEvidencePolicy(input) {
  assertObject(input, 'policy');
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  assertString(input.reviewedAt, 'reviewedAt');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(input.repository ?? '')) {
    throw new TypeError('repository must be owner/name');
  }
  assertObject(input.billingCredential, 'billingCredential');
  if (input.billingCredential.permissionClass !== 'Plan: Read-only') {
    throw new TypeError('billingCredential.permissionClass must equal Plan: Read-only');
  }
  if (input.billingCredential.repositoryAccess !== 'none') {
    throw new TypeError('billingCredential.repositoryAccess must equal none');
  }
  assertString(input.billingCredential.environmentVariable, 'environmentVariable');
  assertString(input.billingCredential.expiresOn, 'expiresOn');
  assertObject(input.billing, 'billing');
  if (!Array.isArray(input.billing.allowedProducts) || input.billing.allowedProducts.length === 0) {
    throw new TypeError('billing.allowedProducts must be non-empty');
  }
  if (!Array.isArray(input.billing.allowedSkus) || input.billing.allowedSkus.length === 0) {
    throw new TypeError('billing.allowedSkus must be non-empty');
  }
  assertObject(input.packages, 'packages');
  if (input.packages.state !== 'owner-verified-zero' || input.packages.count !== 0) {
    throw new TypeError('packages must be owner-verified-zero with count 0');
  }
  assertString(input.packages.checkedAt, 'packages.checkedAt');
  assertObject(input.storage, 'storage');
  for (const key of ['actionsCacheLimitBytes', 'sharedPackagesAndArtifactsBytes']) {
    if (!Number.isSafeInteger(input.storage[key]) || input.storage[key] <= 0) {
      throw new TypeError(`storage.${key} must be a positive integer`);
    }
  }
  return structuredClone(input);
}

export function parseAccountEvidenceArgs(argv) {
  const options = { month: null, output: null, repository: null, year: null };
  for (const argument of argv) {
    if (argument === '--') continue;
    if (argument.startsWith('--repo=')) options.repository = argument.slice('--repo='.length);
    else if (argument.startsWith('--year='))
      options.year = Number(argument.slice('--year='.length));
    else if (argument.startsWith('--month='))
      options.month = Number(argument.slice('--month='.length));
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length);
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options.repository ?? '')) {
    throw new Error('--repo must be owner/name');
  }
  if (!Number.isInteger(options.year) || options.year < 2020 || options.year > 2100) {
    throw new Error('--year must be a four-digit supported year');
  }
  if (!Number.isInteger(options.month) || options.month < 1 || options.month > 12) {
    throw new Error('--month must be 1 through 12');
  }
  return options;
}

export function resolveAccountEvidenceOutputPath(
  output,
  environment = process.env,
  now = new Date(),
) {
  const artifactRoot = resolveArtifactsDirectory(repoRoot, environment);
  const outputPath = output
    ? resolve(repoRoot, output)
    : resolveArtifactPath(
        repoRoot,
        ['github', `account-evidence-${now.toISOString().replace(/[:.]/gu, '-')}.json`],
        environment,
      );
  const artifactRelative = relative(artifactRoot, outputPath);
  if (artifactRelative === '' || artifactRelative.startsWith('..')) {
    throw new Error('--output must resolve inside the configured artifacts directory');
  }
  return outputPath;
}

function roundMoney(value) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function sanitizeBillingUsage(input, policy) {
  assertObject(input, 'billing payload');
  assertExactKeys(input, ['usageItems'], 'billing payload');
  if (!Array.isArray(input.usageItems)) throw new TypeError('usageItems must be an array');
  const [, repositoryName] = policy.repository.split('/');
  const items = input.usageItems.map((item, index) => {
    assertObject(item, `usageItems[${index}]`);
    assertExactKeys(item, billingItemFields, 'billing');
    for (const key of billingItemFields) {
      if (!(key in item)) throw new TypeError(`usageItems[${index}].${key} is required`);
    }
    if (!policy.billing.allowedProducts.includes(item.product)) {
      throw new TypeError(`billing product is not allowlisted: ${item.product}`);
    }
    if (!policy.billing.allowedSkus.includes(item.sku)) {
      throw new TypeError(`billing sku is not allowlisted: ${item.sku}`);
    }
    if (item.repositoryName !== repositoryName) {
      throw new TypeError(`billing repository mismatch: ${item.repositoryName}`);
    }
    for (const key of ['discountAmount', 'grossAmount', 'netAmount', 'pricePerUnit', 'quantity']) {
      if (!Number.isFinite(item[key]) || item[key] < 0) {
        throw new TypeError(`usageItems[${index}].${key} must be a non-negative number`);
      }
    }
    for (const key of ['date', 'product', 'repositoryName', 'sku', 'unitType']) {
      assertString(item[key], `usageItems[${index}].${key}`);
    }
    return structuredClone(item);
  });
  return {
    items,
    summary: {
      discountAmount: roundMoney(items.reduce((total, item) => total + item.discountAmount, 0)),
      grossAmount: roundMoney(items.reduce((total, item) => total + item.grossAmount, 0)),
      itemCount: items.length,
      netAmount: roundMoney(items.reduce((total, item) => total + item.netAmount, 0)),
    },
  };
}

export function classifyBillingApiFailure(input = {}) {
  const stderr = String(input.stderr ?? '');
  if (input.code === 'MISSING_ENV') {
    return {
      code: 'credential-missing',
      ownerAction: 'Resume OMX from the same shell that exports KNU_GITHUB_PLAN_READ_TOKEN.',
      retryable: false,
    };
  }
  if (/HTTP 401/u.test(stderr)) {
    return {
      code: 'credential-invalid',
      ownerAction: 'Regenerate the 30-day Plan-Read token; do not use daily gh as fallback.',
      retryable: false,
    };
  }
  if (/HTTP 403/u.test(stderr)) {
    return {
      code: 'permission-denied',
      ownerAction: 'Verify user Plan Read-only permission without adding repository/admin access.',
      retryable: false,
    };
  }
  if (/HTTP 404/u.test(stderr)) {
    return {
      code: 'endpoint-unavailable',
      ownerAction: 'Use the sanitized Billing UI/CSV fallback and retain the provider blocker.',
      retryable: false,
    };
  }
  if (/HTTP 5\d\d/u.test(stderr) || ['ETIMEDOUT', 'ECONNRESET'].includes(input.code)) {
    return {
      code: 'provider-unavailable',
      ownerAction: 'Retry once, then retain the GitHub provider blocker without widening access.',
      retryable: true,
    };
  }
  return {
    code: 'billing-api-failure',
    ownerAction: 'Inspect the bounded failure class without printing raw provider output.',
    retryable: false,
  };
}

export function requestBillingUsageWithRetry(request) {
  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    const result = request();
    if (result.status === 0 && !result.error) {
      try {
        return { attempts, payload: JSON.parse(result.stdout) };
      } catch {
        throw new AccountEvidenceError(
          'provider-response-invalid',
          'GitHub returned non-JSON billing evidence.',
          'Use the sanitized UI/CSV fallback and retain the malformed-provider blocker.',
        );
      }
    }
    const failure = classifyBillingApiFailure({
      code: result.error?.code,
      stderr: result.stderr,
    });
    if (failure.retryable && attempts < 2) continue;
    throw new AccountEvidenceError(
      failure.code,
      'GitHub billing usage read failed.',
      failure.ownerAction,
      failure.retryable,
    );
  }
  throw new AccountEvidenceError(
    'provider-unavailable',
    'GitHub billing usage retry budget exhausted.',
    'Retain the provider blocker and use sanitized UI/CSV evidence.',
  );
}

export function buildAccountEvidence({ billing, collectedAt, controls, policy, resources }) {
  const evidence = {
    billing: structuredClone(billing),
    collectedAt,
    credential: {
      environmentVariable: policy.billingCredential.environmentVariable,
      expiresOn: policy.billingCredential.expiresOn,
      permissionClass: policy.billingCredential.permissionClass,
      repositoryAccess: policy.billingCredential.repositoryAccess,
      valuePersisted: false,
    },
    controls: structuredClone(controls),
    repository: policy.repository,
    resources: structuredClone(resources),
    schemaVersion: 1,
  };
  const serialized = JSON.stringify(evidence);
  if (credentialPattern.test(serialized)) {
    throw new Error('credential-like value detected in account evidence');
  }
  return evidence;
}

function processEnvironmentWithoutBillingToken(environment = process.env) {
  const next = { ...environment };
  delete next.KNU_GITHUB_PLAN_READ_TOKEN;
  delete next.GH_TOKEN;
  delete next.GITHUB_TOKEN;
  return next;
}

function runGh(args, environment, timeout = 30_000) {
  return spawnSync('gh', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
  });
}

function ghJson(args, environment) {
  const result = runGh(args, environment);
  if (result.status !== 0 || result.error) throw new Error('daily gh read failed');
  return JSON.parse(result.stdout);
}

function flattenPages(pages, key) {
  return pages.flatMap((page) => page[key] ?? []);
}

function collectRepositoryEvidence(repository, policy, environment) {
  const repo = ghJson(
    ['api', `repos/${repository}`, '--jq', '{defaultBranch: .default_branch, visibility}'],
    environment,
  );
  const actions = ghJson(['api', `repos/${repository}/actions/permissions`], environment);
  const workflow = ghJson(['api', `repos/${repository}/actions/permissions/workflow`], environment);
  const securityUpdates = ghJson(
    ['api', `repos/${repository}/automated-security-fixes`],
    environment,
  );
  const alertsResult = runGh(
    ['api', '--silent', `repos/${repository}/vulnerability-alerts`],
    environment,
  );
  if (alertsResult.status !== 0 || alertsResult.error)
    throw new Error('vulnerability alerts read failed');
  const cachePages = ghJson(
    ['api', '--paginate', '--slurp', `repos/${repository}/actions/caches?per_page=100`],
    environment,
  );
  const artifactPages = ghJson(
    ['api', '--paginate', '--slurp', `repos/${repository}/actions/artifacts?per_page=100`],
    environment,
  );
  const resourceInventory = buildResourceInventory({
    artifacts: flattenPages(artifactPages, 'artifacts'),
    caches: flattenPages(cachePages, 'actions_caches'),
    collectedAt: new Date().toISOString(),
    packages: policy.packages,
    repository,
  });
  return {
    controls: {
      actions: {
        allowedActions: actions.allowed_actions,
        defaultWorkflowPermissions: workflow.default_workflow_permissions,
      },
      repository: repo,
      security: {
        dependabotSecurityUpdatesEnabled: securityUpdates.enabled === true,
        vulnerabilityAlertsEnabled: true,
      },
    },
    resources: {
      ...resourceInventory,
      packages: policy.packages,
      storagePolicy: structuredClone(policy.storage),
    },
  };
}

function billingRequest(repository, year, month, token, environment) {
  const [owner] = repository.split('/');
  const billingEnvironment = { ...environment, GH_TOKEN: token };
  const endpoint = `/users/${owner}/settings/billing/usage?year=${year}&month=${month}&repository=${repository}&product=actions`;
  return runGh(['api', endpoint, '--jq', billingJq], billingEnvironment);
}

export function runAccountEvidence(options, environment = process.env, now = new Date()) {
  const policy = parseAccountEvidencePolicy(JSON.parse(readFileSync(policyPath, 'utf8')));
  if (options.repository !== policy.repository) throw new Error('repository does not match policy');
  const token = environment[policy.billingCredential.environmentVariable];
  if (!token) {
    const failure = classifyBillingApiFailure({ code: 'MISSING_ENV' });
    throw new AccountEvidenceError(
      failure.code,
      'Billing token was not inherited by the Agent process.',
      failure.ownerAction,
    );
  }
  const baseEnvironment = processEnvironmentWithoutBillingToken(environment);
  const billingResult = requestBillingUsageWithRetry(() =>
    billingRequest(options.repository, options.year, options.month, token, baseEnvironment),
  );
  const billing = sanitizeBillingUsage(billingResult.payload, policy);
  const repositoryEvidence = collectRepositoryEvidence(options.repository, policy, baseEnvironment);
  const evidence = buildAccountEvidence({
    billing: {
      ...billing,
      requestAttempts: billingResult.attempts,
      year: options.year,
      month: options.month,
    },
    collectedAt: now.toISOString(),
    controls: repositoryEvidence.controls,
    policy,
    resources: repositoryEvidence.resources,
  });
  const outputPath = resolveAccountEvidenceOutputPath(options.output, environment, now);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  chmodSync(outputPath, 0o600);
  return { evidence, outputPath };
}

function main(argv) {
  try {
    const options = parseAccountEvidenceArgs(argv);
    const result = runAccountEvidence(options);
    process.stdout.write(
      `${JSON.stringify(
        {
          billingSummary: result.evidence.billing.summary,
          outputPath: result.outputPath,
          packages: result.evidence.resources.packages,
          status: 'success',
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    const safeError = {
      code: error instanceof AccountEvidenceError ? error.code : 'account-evidence-failure',
      message: error instanceof Error ? error.message : String(error),
      ownerAction:
        error instanceof AccountEvidenceError
          ? error.ownerAction
          : 'Inspect the bounded implementation error without printing environment or provider payloads.',
      status: 'blocked',
    };
    process.stderr.write(`${JSON.stringify(safeError, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
