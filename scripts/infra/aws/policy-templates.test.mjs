import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { API_DOCUMENT_NAME, DOCUMENT_NAME } from '../user-host/ssm-document.mjs';
import {
  API_DEPLOY_DOCUMENT,
  DEPLOY_DOCUMENT,
  checkPolicyTemplates,
  readPolicyTemplates,
} from './policy-templates.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

function mutated(path, change) {
  const files = readPolicyTemplates(repoRoot);
  const policy = JSON.parse(files[path]);
  change(policy);
  files[path] = JSON.stringify(policy);
  return checkPolicyTemplates(files);
}

test('the committed AWS policy templates meet the user host CD trust and permission contract', () => {
  assert.deepEqual(checkPolicyTemplates(readPolicyTemplates(repoRoot)), []);
  assert.equal(DEPLOY_DOCUMENT, DOCUMENT_NAME);
  assert.equal(API_DEPLOY_DOCUMENT, API_DOCUMENT_NAME);
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
      'infra/aws/iam/deploy-role.permissions.json',
      (p) => p.Statement.push({ Effect: 'Allow', Action: 'ecr:PutImage', Resource: '*' }),
      /deploy permissions: action ecr:PutImage is not allowed/u,
    ],
    [
      'infra/aws/iam/deploy-role.permissions.json',
      (p) => (p.Statement.find((s) => s.Action === 'ecr:BatchGetImage').Resource = '*'),
      /deploy permissions: ecr:BatchGetImage resource or condition is wider/u,
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
  const apiDocument = 'arn:aws:ssm:ap-northeast-2:<ACCOUNT_ID>:document/dormduri-api-deploy';
  const webDocument = 'arn:aws:ssm:ap-northeast-2:<ACCOUNT_ID>:document/dormduri-web-deploy';
  const webRepository = 'arn:aws:ecr:ap-northeast-2:<ACCOUNT_ID>:repository/dormduri/web';
  cases.push(
    // The api-cd roles are separate from the web-cd roles: their own workflow, environment, repositories and document.
    [
      'infra/aws/iam/api-deploy-role.trust.json',
      (p) => {
        p.Statement[0].Condition.StringEquals[sub] = p.Statement[0].Condition.StringEquals[
          sub
        ].replace('api-cd.yml', 'web-cd.yml');
      },
      /api-deploy trust: sub is not the exact environment:production-api api-cd\.yml subject/u,
    ],
    [
      'infra/aws/iam/api-deploy-role.trust.json',
      (p) => {
        p.Statement[0].Condition.StringEquals[sub] = p.Statement[0].Condition.StringEquals[
          sub
        ].replace('environment:production-api', 'environment:production');
      },
      /api-deploy trust: sub is not the exact/u,
    ],
    [
      'infra/aws/iam/api-publish-role.permissions.json',
      (p) => p.Statement[1].Resource.push(webRepository),
      /api publish permissions: ecr:PutImage resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/api-publish-role.permissions.json',
      (p) => (p.Statement[1].Resource = p.Statement[1].Resource.slice(0, 2)),
      /api publish permissions: ecr:PutImage resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/api-deploy-role.permissions.json',
      (p) => (p.Statement.find((s) => s.Resource === apiDocument).Resource = webDocument),
      /api deploy permissions: ssm:SendCommand reaches more than/u,
    ],
    [
      'infra/aws/iam/api-deploy-role.permissions.json',
      (p) =>
        (p.Statement.find((s) => s.Action === 'ssm:DescribeDocument').Resource = [
          apiDocument,
          webDocument,
        ]),
      /api deploy permissions: ssm:DescribeDocument resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/api-deploy-role.permissions.json',
      (p) =>
        p.Statement.push({
          Effect: 'Allow',
          Action: 'secretsmanager:GetSecretValue',
          Resource: '*',
        }),
      /api deploy permissions: action secretsmanager:GetSecretValue is not allowed/u,
    ],
    // The host role reads only the three user host bundles, never the RDS managed master secret or another secret.
    [
      'infra/aws/iam/host-role.secrets-read.json',
      (p) =>
        (p.Statement[0].Resource = [
          'arn:aws:secretsmanager:ap-northeast-2:<ACCOUNT_ID>:secret:/dormduri/*',
        ]),
      /host secrets: secretsmanager:GetSecretValue resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/host-role.secrets-read.json',
      (p) => (p.Statement[0].Resource[0] = p.Statement[0].Resource[0].replace('-??????', '-*')),
      /host secrets: .* has a \* wildcard/u,
    ],
    [
      'infra/aws/iam/host-role.secrets-read.json',
      (p) =>
        (p.Statement[0].Action = [
          'secretsmanager:GetSecretValue',
          'secretsmanager:PutSecretValue',
        ]),
      /host secrets: action secretsmanager:PutSecretValue is not allowed/u,
    ],
    [
      'infra/aws/iam/host-role.ecr-pull.json',
      (p) => (p.Statement[1].Resource = p.Statement[1].Resource.slice(0, 4)),
      /host permissions: ecr:BatchGetImage resource or condition is wider/u,
    ],
    [
      'infra/aws/iam/publish-role.permissions.json',
      (p) =>
        p.Statement[1].Resource.push(
          'arn:aws:ecr:ap-northeast-2:<ACCOUNT_ID>:repository/dormduri/api',
        ),
      /^publish permissions: ecr:PutImage resource or condition is wider/u,
    ],
  );
  for (const [path, change, expected] of cases) {
    const problems = mutated(path, change);
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
});
