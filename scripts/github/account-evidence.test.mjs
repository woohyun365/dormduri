import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildAccountEvidence,
  classifyBillingApiFailure,
  findCredentialLikeValue,
  parseAccountEvidenceArgs,
  parseAccountEvidencePolicy,
  requestBillingUsageWithRetry,
  resolveAccountEvidenceOutputPath,
  sanitizeBillingUsage,
} from './account-evidence.mjs';

const policyUrl = new URL('./fixtures/account-evidence-policy.json', import.meta.url);
const policy = parseAccountEvidencePolicy(JSON.parse(await readFile(policyUrl, 'utf8')));

const billingPayload = {
  usageItems: [
    {
      date: '2026-08-26',
      discountAmount: 0.18,
      grossAmount: 0.18,
      netAmount: 0,
      pricePerUnit: 0.006,
      product: 'actions',
      quantity: 30,
      repositoryName: 'knu_roommate',
      sku: 'Actions Linux',
      unitType: 'Minutes',
    },
    {
      date: '2026-08-26',
      discountAmount: 0.001,
      grossAmount: 0.001,
      netAmount: 0,
      pricePerUnit: 0.00033602,
      product: 'actions',
      quantity: 3,
      repositoryName: 'knu_roommate',
      sku: 'Actions storage',
      unitType: 'GigabyteHours',
    },
  ],
};

test('detects complete classic and stateless GitHub App installation tokens', () => {
  const installationPrefix = ['ghs', ''].join('_');
  const classic = `${installationPrefix}${'A1'.repeat(18)}`;
  const stateless = [
    ['ghs', '123456', 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9'].join('_'),
    `eyJpbnN0YWxsYXRpb25JZCI6MTIzNDU2LCJwYWRkaW5nIjoi${'Ab-_'.repeat(105)}In0`,
    'signature-with_url-safe-characters',
  ].join('.');

  assert.ok(stateless.length > 520);
  assert.equal(findCredentialLikeValue(`before ${classic} after`), classic);
  assert.equal(findCredentialLikeValue(`before ${stateless} after`), stateless);
  assert.equal(findCredentialLikeValue('ghs_short.a-b'), null);

  for (const prefix of ['ghp', 'gho', 'ghu', 'ghr']) {
    const token = `${prefix}_${'Ab_1'.repeat(4)}`;
    assert.equal(findCredentialLikeValue(`before ${token} after`), token);
  }

  const fineGrainedPat = `github_pat_${'Ab_1'.repeat(4)}`;
  assert.equal(findCredentialLikeValue(`before ${fineGrainedPat} after`), fineGrainedPat);
});

test('accepts only the bounded Plan-Read policy', () => {
  assert.equal(policy.billingCredential.permissionClass, 'Plan: Read-only');
  assert.equal(policy.billingCredential.repositoryAccess, 'none');
  assert.equal(policy.packages.state, 'owner-verified-zero');

  assert.throws(
    () =>
      parseAccountEvidencePolicy({
        ...policy,
        billingCredential: { ...policy.billingCredential, permissionClass: 'Plan: Write' },
      }),
    /Plan: Read-only/u,
  );
});

test('sanitizes billing rows and reconciles gross, discount, and net totals', () => {
  const billing = sanitizeBillingUsage(billingPayload, policy);

  assert.deepEqual(billing.summary, {
    discountAmount: 0.181,
    grossAmount: 0.181,
    itemCount: 2,
    netAmount: 0,
  });
  assert.deepEqual(billing.items[0], billingPayload.usageItems[0]);
  assert.equal(JSON.stringify(billing).includes('token'), false);
});

test('rejects unknown provider fields instead of persisting a raw account payload', () => {
  assert.throws(
    () =>
      sanitizeBillingUsage(
        {
          usageItems: [{ ...billingPayload.usageItems[0], paymentMethod: 'forbidden' }],
        },
        policy,
      ),
    /unknown billing field/u,
  );
});

test('classifies missing, expired, permission, endpoint, and provider failures', () => {
  assert.equal(classifyBillingApiFailure({ code: 'MISSING_ENV' }).code, 'credential-missing');
  assert.equal(classifyBillingApiFailure({ stderr: 'HTTP 401' }).code, 'credential-invalid');
  assert.equal(classifyBillingApiFailure({ stderr: 'HTTP 403' }).code, 'permission-denied');
  assert.equal(classifyBillingApiFailure({ stderr: 'HTTP 404' }).code, 'endpoint-unavailable');
  assert.equal(classifyBillingApiFailure({ stderr: 'HTTP 503' }).code, 'provider-unavailable');
  assert.equal(classifyBillingApiFailure({ code: 'ETIMEDOUT' }).code, 'provider-unavailable');
});

test('retries one provider failure but never retries credential failures', () => {
  let attempts = 0;
  const success = requestBillingUsageWithRetry(() => {
    attempts += 1;
    if (attempts === 1) return { status: 1, stderr: 'HTTP 503', stdout: '' };
    return { status: 0, stderr: '', stdout: JSON.stringify(billingPayload) };
  });
  assert.equal(success.attempts, 2);

  attempts = 0;
  assert.throws(
    () =>
      requestBillingUsageWithRetry(() => {
        attempts += 1;
        return { status: 1, stderr: 'HTTP 401', stdout: '' };
      }),
    /credential-invalid/u,
  );
  assert.equal(attempts, 1);
});

test('builds evidence from allowlisted account, repository, and resource fields', () => {
  const evidence = buildAccountEvidence({
    billing: sanitizeBillingUsage(billingPayload, policy),
    collectedAt: '2026-08-26T00:00:00.000Z',
    controls: {
      actions: { allowedActions: 'selected', defaultWorkflowPermissions: 'read' },
      repository: { defaultBranch: 'main', visibility: 'private' },
      security: { dependabotSecurityUpdatesEnabled: true, vulnerabilityAlertsEnabled: true },
    },
    policy,
    resources: {
      artifacts: { activeCount: 3, activeSizeBytes: 1000 },
      cache: { activeCount: 2, activeSizeBytes: 2000 },
      packages: policy.packages,
    },
  });

  assert.equal(evidence.credential.valuePersisted, false);
  assert.equal(evidence.credential.environmentVariable, 'KNU_GITHUB_PLAN_READ_TOKEN');
  assert.deepEqual(evidence.resources.packages, policy.packages);
  assert.equal(JSON.stringify(evidence).includes('github_pat_'), false);
});

test('keeps token arguments and outputs outside .artifacts/tools out of the CLI', () => {
  assert.deepEqual(
    parseAccountEvidenceArgs([
      '--',
      '--repo=woohyun365/knu_roommate',
      '--year=2026',
      '--month=8',
      '--output=.artifacts/tools/github/account.json',
    ]),
    {
      month: 8,
      output: '.artifacts/tools/github/account.json',
      repository: 'woohyun365/knu_roommate',
      year: 2026,
    },
  );
  assert.throws(() => parseAccountEvidenceArgs(['--token=secret']), /unknown argument/u);
  assert.match(
    resolveAccountEvidenceOutputPath('.artifacts/tools/github/account.json'),
    /\.artifacts\/tools\/github\/account\.json$/u,
  );
  assert.throws(
    () => resolveAccountEvidenceOutputPath('docs/account.json'),
    /artifacts directory/u,
  );
});
