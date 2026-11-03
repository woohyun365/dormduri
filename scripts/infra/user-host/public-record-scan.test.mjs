import assert from 'node:assert/strict';
import test from 'node:test';

import { FORBIDDEN_KINDS, scanText } from './public-record-scan.mjs';

// Fake values only. Each line must be found as exactly its own kind.
const POSITIVE = {
  'AWS account ID': 'role in account 210987654321 assumed',
  ARN: 'role-to-assume arn:aws:iam::<ACCOUNT_ID>:role/example',
  'AWS unique ID': 'Authenticated as assumedRoleId AROAEXAMPLEFAKEROLEID:GitHubActions',
  'registry host': 'pushed to example.dkr.ecr.ap-northeast-2.amazonaws.com/dormduri/web',
  'managed node or instance ID': 'target mi-0123456789abcdef0 and i-0abc1234def567890',
  'IPv4 address': 'resolved to 203.0.113.17 on port 443',
  'email address': 'contact owner@example.org about this',
  'ACME account URI': 'account https://acme-v02.api.letsencrypt.org/acme/acct/123',
  'activation ID': 'activation 0f8fad5b-d9cb-469f-a165-70867728950e registered',
};

// Values the public records must keep: none of these lines may be reported.
const NEGATIVE = [
  'web: dormduri/web@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606',
  'source: 81675ef53d91fef89ef118851afe3704498c2ba6',
  // The deploy job prints the SSM document hash without a prefix; a random hash can hold a 12-digit run.
  `document hash matches (ab${'210987654321'}cd${'e'.repeat(48)})`,
  'run: https://github.com/woohyun365/dormduri/actions/runs/41573137218/job/125710567034',
  'image tag deploy-20261027T1530-42 and git tag deploy-web-20261027-42',
  '2026-11-03T03:42:19.1234567Z ##[group]Run node scripts/infra/user-host/external-smoke.mjs',
  'nginx:1.31.8-alpine Node 26.13.0 Docker-Buildx 0.38.1 skopeo 1.21.0-dev',
  'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
  'loopback 127.0.0.1 and wildcard 0.0.0.0 bind',
  'GET https://dormduri.com/signup 503 돔두리 — 준비 중 PASS',
  // GitHub runner temp paths and worker IDs are per-job UUIDs, not activation IDs.
  "Temporarily overriding HOME='/home/runner/work/_temp/3f2b8c1e-5a4d-4e7f-9b6a-0c1d2e3f4a5b' before making global git config changes",
  'git config --local includeIf.gitdir:/github/workspace/.git.path /github/runner_temp/git-credentials-3f2b8c1e-5a4d-4e7f-9b6a-0c1d2e3f4a5b.config',
  'Worker ID: {3f2b8c1e-5a4d-4e7f-9b6a-0c1d2e3f4a5b}',
  // The workflow script source prints the registry host template, not a host.
  'echo "::add-mask::$account.dkr.ecr.$AWS_REGION.amazonaws.com"',
  // A masked role ID keeps only the tail after the masked account part.
  'Authenticated as assumedRoleId ***EXAMPLEFAKE:GitHubActions',
];

test('every forbidden kind is found by its own pattern and the value is not reported', () => {
  assert.deepEqual(Object.keys(POSITIVE).sort(), FORBIDDEN_KINDS.map(([kind]) => kind).sort());
  for (const [kind, line] of Object.entries(POSITIVE)) {
    const findings = scanText(line, 'fixture');
    assert.deepEqual(
      findings.map((finding) => finding.kind),
      [kind],
      `${kind}: ${JSON.stringify(findings)}`,
    );
    assert.deepEqual(Object.keys(findings[0]).sort(), ['kind', 'line', 'source']);
  }
});

test('digests, commit SHAs, run URLs, deploy tags, timestamps and versions pass', () => {
  for (const line of NEGATIVE) assert.deepEqual(scanText(line), [], line);
});

test('an allowed value does not hide a forbidden value on the same line', () => {
  const line = `${NEGATIVE[0]} from 210987654321.dkr.ecr.ap-northeast-2.amazonaws.com`;
  assert.deepEqual(
    scanText(line)
      .map((finding) => finding.kind)
      .sort(),
    ['AWS account ID', 'registry host'],
  );
});

test('a runner temp path or a registry host template does not hide a real value', () => {
  const runnerPath = '/home/runner/work/_temp/3f2b8c1e-5a4d-4e7f-9b6a-0c1d2e3f4a5b';
  assert.deepEqual(
    scanText(`${runnerPath} activation 0f8fad5b-d9cb-469f-a165-70867728950e`).map((f) => f.kind),
    ['activation ID'],
  );
  assert.deepEqual(
    scanText('/tmp/3f2b8c1e-5a4d-4e7f-9b6a-0c1d2e3f4a5b outside the runner temp').map(
      (f) => f.kind,
    ),
    ['activation ID'],
  );
  assert.deepEqual(
    scanText(
      '$account.dkr.ecr.$AWS_REGION.amazonaws.com and 210987654321.dkr.ecr.ap-northeast-2.amazonaws.com',
    )
      .map((f) => f.kind)
      .sort(),
    ['AWS account ID', 'registry host'],
  );
  assert.deepEqual(
    scanText('example.dkr.ecr.$AWS_REGION.amazonaws.com').map((f) => f.kind),
    ['registry host'],
  );
});

test('findings carry the source and the line number', () => {
  const findings = scanText(['ok', POSITIVE['IPv4 address']].join('\n'), 'release.md');
  assert.deepEqual(findings, [{ kind: 'IPv4 address', source: 'release.md', line: 2 }]);
});
