// Web 단계 CD의 AWS 정책 원본(infra/aws/iam/*.json, infra/aws/ecr/lifecycle-policy.json) 계약. 각 함수는 어긋난 점의
// 목록을 돌려준다(빈 목록 = 통과). 기준: production-web-baseline D-WB3·D-WB4(OIDC trust는 aud와 정확한 sub를
// StringEquals로만 받는다, publish는 두 repository push만, deploy는 tag 붙은 managed node와 custom document 하나에만
// SendCommand, document 갱신 권한 없음, host role은 두 repository pull만)와 D-WB7(식별자는 placeholder).
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REGION = 'ap-northeast-2';
export const REPOSITORIES = Object.freeze(['dormduri/web', 'dormduri/ingress']);
export const DEPLOY_DOCUMENT = 'dormduri-web-deploy';
export const PLACEHOLDERS = Object.freeze([
  '<ACCOUNT_ID>',
  '<GITHUB_OWNER_ID>',
  '<GITHUB_REPO_ID>',
]);
const OIDC_PROVIDER = 'token.actions.githubusercontent.com';
const WORKFLOW_REF = 'woohyun365/dormduri/.github/workflows/web-cd.yml@refs/heads/main';
export const OIDC_CONTEXTS = Object.freeze({
  publish: 'ref:refs/heads/main',
  deploy: 'environment:production',
});
export const PUBLISH_ACTIONS = Object.freeze([
  'ecr:BatchCheckLayerAvailability',
  'ecr:BatchGetImage',
  'ecr:CompleteLayerUpload',
  'ecr:InitiateLayerUpload',
  'ecr:PutImage',
  'ecr:UploadLayerPart',
]);

const repositoryArns = REPOSITORIES.map(
  (name) => `arn:aws:ecr:${REGION}:<ACCOUNT_ID>:repository/${name}`,
).sort();
const documentArn = `arn:aws:ssm:${REGION}:<ACCOUNT_ID>:document/${DEPLOY_DOCUMENT}`;

const asList = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
const sameSet = (left, right) =>
  JSON.stringify([...asList(left)].sort()) === JSON.stringify([...asList(right)].sort());

export function expectedSubject(role) {
  return `repo:woohyun365@<GITHUB_OWNER_ID>/dormduri@<GITHUB_REPO_ID>:${OIDC_CONTEXTS[role]}:job_workflow_ref:${WORKFLOW_REF}`;
}

// 파일 원문에 실제 식별자처럼 보이는 값이 없고 placeholder만 쓰는지 본다.
export function identifierProblems(name, source) {
  const problems = [];
  if (/\b\d{12}\b/u.test(source)) problems.push(`${name}: contains a 12-digit account-like number`);
  for (const placeholder of source.match(/<[^>]+>/gu) ?? []) {
    if (!PLACEHOLDERS.includes(placeholder))
      problems.push(`${name}: unknown placeholder ${placeholder}`);
  }
  return problems;
}

export function oidcTrustProblems(role, policy) {
  const problems = [];
  const statements = asList(policy.Statement);
  if (statements.length !== 1) return [`${role} trust: expected one statement`];
  const [statement] = statements;
  if (statement.Effect !== 'Allow') problems.push(`${role} trust: effect is not Allow`);
  if (
    statement.Principal?.Federated !== `arn:aws:iam::<ACCOUNT_ID>:oidc-provider/${OIDC_PROVIDER}`
  ) {
    problems.push(`${role} trust: principal is not the GitHub OIDC provider`);
  }
  if (!sameSet(statement.Action, ['sts:AssumeRoleWithWebIdentity']))
    problems.push(`${role} trust: action is not only sts:AssumeRoleWithWebIdentity`);
  const operators = Object.keys(statement.Condition ?? {});
  if (!sameSet(operators, ['StringEquals']))
    problems.push(`${role} trust: conditions must use only StringEquals`);
  const equals = statement.Condition?.StringEquals ?? {};
  if (equals[`${OIDC_PROVIDER}:aud`] !== 'sts.amazonaws.com')
    problems.push(`${role} trust: aud is not sts.amazonaws.com`);
  const subject = equals[`${OIDC_PROVIDER}:sub`];
  if (subject !== expectedSubject(role))
    problems.push(`${role} trust: sub is not the exact ${OIDC_CONTEXTS[role]} web-cd.yml subject`);
  if (/[*?]/u.test(String(subject))) problems.push(`${role} trust: sub contains a wildcard`);
  return problems;
}

export function subjectTemplateProblems(template) {
  const problems = [];
  if (template.use_default !== false) problems.push('sub template: use_default is not false');
  if (template.use_immutable_subject !== true)
    problems.push('sub template: use_immutable_subject is not true');
  if (JSON.stringify(template.include_claim_keys) !== '["repo","context","job_workflow_ref"]')
    problems.push('sub template: claim keys are not repo, context, job_workflow_ref');
  return problems;
}

function allowedStatements(name, policy, allowed) {
  const problems = [];
  for (const statement of asList(policy.Statement)) {
    if (statement.Effect !== 'Allow' || statement.NotAction || statement.NotResource) {
      problems.push(`${name}: statement ${statement.Sid ?? '?'} is not a plain Allow`);
      continue;
    }
    for (const action of asList(statement.Action)) {
      const rule = allowed[action];
      if (!rule) {
        problems.push(`${name}: action ${action} is not allowed`);
        continue;
      }
      if (!rule(asList(statement.Resource).sort(), statement.Condition)) {
        problems.push(`${name}: ${action} resource or condition is wider than allowed`);
      }
    }
  }
  const granted = asList(policy.Statement).flatMap((statement) => asList(statement.Action));
  for (const action of Object.keys(allowed)) {
    if (!granted.includes(action)) problems.push(`${name}: ${action} is missing`);
  }
  return problems;
}

const anyResource = (resources, condition) => sameSet(resources, ['*']) && !condition;
const twoRepositories = (resources, condition) => sameSet(resources, repositoryArns) && !condition;

export function publishPermissionProblems(policy) {
  return allowedStatements('publish permissions', policy, {
    'ecr:GetAuthorizationToken': anyResource,
    ...Object.fromEntries(PUBLISH_ACTIONS.map((action) => [action, twoRepositories])),
  });
}

export function deployPermissionProblems(policy) {
  const problems = [];
  const sendResources = asList(policy.Statement)
    .filter((statement) => asList(statement.Action).includes('ssm:SendCommand'))
    .flatMap((statement) => asList(statement.Resource));
  if (
    !sameSet(sendResources, [`arn:aws:ssm:${REGION}:<ACCOUNT_ID>:managed-instance/*`, documentArn])
  )
    problems.push(
      'deploy permissions: ssm:SendCommand reaches more than the tagged node and the deploy document',
    );
  problems.push(
    ...allowedStatements('deploy permissions', policy, {
      'ssm:SendCommand': (resources, condition) =>
        (sameSet(resources, [documentArn]) && !condition) ||
        (sameSet(resources, [`arn:aws:ssm:${REGION}:<ACCOUNT_ID>:managed-instance/*`]) &&
          sameSet(Object.keys(condition ?? {}), ['StringEquals']) &&
          condition.StringEquals['ssm:resourceTag/dormduri-deploy-target'] === 'user-app'),
      'ssm:DescribeDocument': (resources, condition) =>
        sameSet(resources, [documentArn]) && !condition,
      'ssm:ListCommands': anyResource,
      'ecr:DescribeImages': twoRepositories,
    }),
  );
  return problems;
}

export function hostTrustProblems(policy) {
  const statements = asList(policy.Statement);
  const [statement] = statements;
  const problems = [];
  if (statements.length !== 1 || statement.Principal?.Service !== 'ssm.amazonaws.com')
    problems.push('host trust: principal is not only ssm.amazonaws.com');
  if (!sameSet(statement?.Action, ['sts:AssumeRole']))
    problems.push('host trust: action is not only sts:AssumeRole');
  if (statement?.Condition?.StringEquals?.['aws:SourceAccount'] !== '<ACCOUNT_ID>')
    problems.push('host trust: aws:SourceAccount is not pinned');
  return problems;
}

export function hostPermissionProblems(policy) {
  return allowedStatements('host permissions', policy, {
    'ecr:GetAuthorizationToken': anyResource,
    'ecr:BatchGetImage': twoRepositories,
    'ecr:GetDownloadUrlForLayer': twoRepositories,
  });
}

export function lifecycleProblems(policy) {
  const problems = [];
  const rules = asList(policy.rules);
  const priorities = rules.map((rule) => rule.rulePriority);
  if (new Set(priorities).size !== priorities.length)
    problems.push('lifecycle: duplicate priority');
  for (const rule of rules) {
    if (rule.action?.type !== 'expire') problems.push(`lifecycle ${rule.rulePriority}: not expire`);
    const selection = rule.selection ?? {};
    if (selection.tagStatus === 'any')
      problems.push(`lifecycle ${rule.rulePriority}: selects every image`);
  }
  const deployRule = rules.find((rule) =>
    asList(rule.selection?.tagPrefixList).includes('deploy-'),
  );
  if (deployRule?.selection?.countType !== 'imageCountMoreThan')
    problems.push('lifecycle: deploy- images are not kept by count');
  return problems;
}

export function readPolicyTemplates(repoRoot) {
  const directory = resolve(repoRoot, 'infra/aws/iam');
  const files = Object.fromEntries(
    readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .map((name) => [`infra/aws/iam/${name}`, readFileSync(join(directory, name), 'utf8')]),
  );
  files['infra/aws/ecr/lifecycle-policy.json'] = readFileSync(
    resolve(repoRoot, 'infra/aws/ecr/lifecycle-policy.json'),
    'utf8',
  );
  return files;
}

export function checkPolicyTemplates(files) {
  const json = (path) => JSON.parse(files[`infra/aws/${path}`]);
  const expected = [
    'iam/deploy-role.permissions.json',
    'iam/deploy-role.trust.json',
    'iam/github-oidc-sub-template.json',
    'iam/host-role.ecr-pull.json',
    'iam/host-role.trust.json',
    'iam/publish-role.permissions.json',
    'iam/publish-role.trust.json',
    'ecr/lifecycle-policy.json',
  ].map((path) => `infra/aws/${path}`);
  if (!sameSet(Object.keys(files), expected)) {
    return [`policy files differ: ${Object.keys(files).sort().join(', ')}`];
  }
  return [
    ...Object.entries(files).flatMap(([name, source]) => identifierProblems(name, source)),
    ...oidcTrustProblems('publish', json('iam/publish-role.trust.json')),
    ...oidcTrustProblems('deploy', json('iam/deploy-role.trust.json')),
    ...subjectTemplateProblems(json('iam/github-oidc-sub-template.json')),
    ...publishPermissionProblems(json('iam/publish-role.permissions.json')),
    ...deployPermissionProblems(json('iam/deploy-role.permissions.json')),
    ...hostTrustProblems(json('iam/host-role.trust.json')),
    ...hostPermissionProblems(json('iam/host-role.ecr-pull.json')),
    ...lifecycleProblems(json('ecr/lifecycle-policy.json')),
  ];
}
