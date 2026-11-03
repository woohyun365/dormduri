import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCUMENT_NAME } from '../user-host/ssm-document.mjs';
import { DEPLOY_DOCUMENT, checkPolicyTemplates, readPolicyTemplates } from './policy-templates.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

function mutated(path, change) {
  const files = readPolicyTemplates(repoRoot);
  const policy = JSON.parse(files[path]);
  change(policy);
  files[path] = JSON.stringify(policy);
  return checkPolicyTemplates(files);
}

test('the committed AWS policy templates meet the Web CD trust and permission contract', () => {
  assert.deepEqual(checkPolicyTemplates(readPolicyTemplates(repoRoot)), []);
  assert.equal(DEPLOY_DOCUMENT, DOCUMENT_NAME);
});

test('each widened trust or permission is rejected', () => {
  const sub = 'token.actions.githubusercontent.com:sub';
  const cases = [
    [
      'infra/aws/iam/deploy-role.trust.json',
      (p) => (p.Statement[0].Condition.StringEquals[sub] += '*'),
      /deploy trust: sub contains a wildcard/u,
    ],
    [
      'infra/aws/iam/publish-role.trust.json',
      (p) => {
        p.Statement[0].Condition.StringLike = { [sub]: 'repo:*' };
      },
      /publish trust: conditions must use only StringEquals/u,
    ],
    [
      'infra/aws/iam/deploy-role.trust.json',
      (p) => {
        p.Statement[0].Condition.StringEquals[sub] = p.Statement[0].Condition.StringEquals[
          sub
        ].replace('environment:production', 'ref:refs/heads/main');
      },
      /deploy trust: sub is not the exact environment:production/u,
    ],
    [
      'infra/aws/iam/publish-role.trust.json',
      (p) =>
        delete p.Statement[0].Condition.StringEquals['token.actions.githubusercontent.com:aud'],
      /publish trust: aud is not sts\.amazonaws\.com/u,
    ],
    [
      'infra/aws/iam/github-oidc-sub-template.json',
      (p) => (p.include_claim_keys = ['repo', 'context']),
      /sub template: claim keys/u,
    ],
    [
      'infra/aws/iam/publish-role.permissions.json',
      (p) => p.Statement[1].Action.push('ecr:DeleteRepository'),
      /publish permissions: action ecr:DeleteRepository is not allowed/u,
    ],
    [
      'infra/aws/iam/publish-role.permissions.json',
      (p) => (p.Statement[1].Resource = '*'),
      /publish permissions: ecr:PutImage resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/deploy-role.permissions.json',
      (p) => p.Statement.push({ Effect: 'Allow', Action: 'ssm:UpdateDocument', Resource: '*' }),
      /deploy permissions: action ssm:UpdateDocument is not allowed/u,
    ],
    [
      'infra/aws/iam/deploy-role.permissions.json',
      (p) => (p.Statement[1].Resource = 'arn:aws:ssm:ap-northeast-2::document/AWS-RunShellScript'),
      /deploy permissions: ssm:SendCommand reaches more than/u,
    ],
    [
      'infra/aws/iam/deploy-role.permissions.json',
      (p) => delete p.Statement[0].Condition,
      /deploy permissions: ssm:SendCommand resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/host-role.trust.json',
      (p) => (p.Statement[0].Principal = { Service: 'ec2.amazonaws.com' }),
      /host trust: principal is not only ssm\.amazonaws\.com/u,
    ],
    [
      'infra/aws/iam/host-role.ecr-pull.json',
      (p) => p.Statement[1].Action.push('ecr:PutImage'),
      /host permissions: action ecr:PutImage is not allowed/u,
    ],
    [
      'infra/aws/ecr/lifecycle-policy.json',
      (p) => (p.rules[0].selection.tagStatus = 'any'),
      /lifecycle 1: selects every image/u,
    ],
    [
      'infra/aws/ecr/lifecycle-policy.json',
      (p) => {
        p.rules[0].rulePriority = 2;
        p.rules[1].rulePriority = 1;
      },
      /lifecycle: deploy- rule is not the first rule/u,
    ],
    [
      'infra/aws/ecr/lifecycle-policy.json',
      (p) => (p.rules[0].selection.countNumber = 1),
      /lifecycle: deploy- keeps fewer than the current and previous pair/u,
    ],
    [
      'infra/aws/iam/host-role.trust.json',
      (p) => (p.Statement[0].Condition.StringEquals['aws:SourceAccount'] = '123456789012'),
      /host-role\.trust\.json: contains a 12-digit account-like number/u,
    ],
  ];
  for (const [path, change, expected] of cases) {
    const problems = mutated(path, change);
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
});
