import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const workflowsRoot = join(repoRoot, '.github/workflows');
const deployScriptsRoot = join(repoRoot, 'infra/deploy/scripts');
const awsRoot = join(repoRoot, 'infra/aws');
const runbooksRoot = join(repoRoot, 'infra/runbooks');

const requiredFiles = [
  '.github/workflows/api-ci.yml',
  '.github/workflows/api-deploy-production.yml',
  'infra/deploy/scripts/api-production-rollout.sh',
  'infra/deploy/scripts/api-release-smoke.sh',
  'infra/aws/github-actions-oidc-checklist.md',
  'infra/aws/beginner-account-budget-checklist.md',
  'infra/runbooks/api-production-deploy-runbook.md',
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readWorkflow(fileName: string): string {
  return readFileSync(join(workflowsRoot, fileName), 'utf8');
}

function readDeployScript(fileName: string): string {
  return readFileSync(join(deployScriptsRoot, fileName), 'utf8');
}

function expectOrdered(content: string, orderedNeedles: string[]): void {
  let cursor = -1;
  for (const needle of orderedNeedles) {
    const next = content.indexOf(needle);
    expect(next, `missing ${needle}`).toBeGreaterThanOrEqual(0);
    expect(next, `${needle} should appear after the previous release step`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe('GitHub Actions API deploy boundary', () => {
  it('keeps API CI/CD workflow, deploy scripts, and operator checklists in expected locations', () => {
    const missingFiles = requiredFiles.filter(
      (relativePath) => !existsSync(join(repoRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);
    expect(statSync(join(deployScriptsRoot, 'api-production-rollout.sh')).mode & 0o111).not.toBe(0);
    expect(statSync(join(deployScriptsRoot, 'api-release-smoke.sh')).mode & 0o111).not.toBe(0);
  });

  it('keeps PR/push API CI read-only and local-equivalent', () => {
    const workflow = readWorkflow('api-ci.yml');

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('push:');
    expect(workflow).toContain('- dev');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('id-token: write');
    expect(workflow).not.toContain('aws-actions/configure-aws-credentials');
    expect(workflow).not.toContain('secrets.');

    expectOrdered(workflow, [
      'actions/checkout@v6',
      'actions/setup-node@v6',
      'corepack prepare pnpm@10.34.3 --activate',
      'pnpm install --frozen-lockfile',
      'pnpm shared:build',
      'pnpm api:prisma:generate',
      'pnpm check:api',
      'pnpm test:api',
      'pnpm build:api',
      'docker compose -f infra/deploy/docker-compose.api.yml config',
    ]);
  });

  it('keeps production deploy manual, protected, OIDC-based, and ordered', () => {
    const workflow = readWorkflow('api-deploy-production.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('dry_run:');
    expect(workflow).toContain('default: true');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('permissions:\n  contents: read\n  id-token: write');
    expect(workflow).toContain('aws-actions/configure-aws-credentials@v6.1.0');
    expect(workflow).toContain('non-dry-run production deploy must run from main');
    expect(workflow).toContain('role-to-assume: ${{ vars.AWS_ROLE_TO_ASSUME }}');
    expect(workflow).not.toContain('AWS_ACCESS_KEY_ID');
    expect(workflow).not.toContain('AWS_SECRET_ACCESS_KEY');

    expectOrdered(workflow, [
      'pnpm install --frozen-lockfile',
      'pnpm check:api',
      'pnpm test:api',
      'pnpm build:api',
      'docker compose -f infra/deploy/docker-compose.api.yml config',
      'docker build -f infra/deploy/api/Dockerfile',
      'aws-actions/configure-aws-credentials@v6.1.0',
      'pnpm api:db:deploy:migrate',
      'pnpm api:db:deploy:role-grants',
      'pnpm api:db:deploy:smoke',
      'infra/deploy/scripts/api-production-rollout.sh',
      'infra/deploy/scripts/api-release-smoke.sh',
      'actions/upload-artifact@v4',
    ]);
  });

  it('keeps deploy scripts dry-run capable and avoids printing secret values', () => {
    const rollout = readDeployScript('api-production-rollout.sh');
    const smoke = readDeployScript('api-release-smoke.sh');

    for (const script of [rollout, smoke]) {
      expect(script).toContain('--dry-run');
      expect(script).toContain('missing required env: $name');
      expect(script).not.toContain('echo "$MIGRATION_DATABASE_URL"');
      expect(script).not.toContain('echo "$DATABASE_URL"');
      expect(script).not.toContain('echo "$METRICS_BEARER_TOKEN"');
      expect(script).not.toContain('cat infra/deploy/.env.api');
    }

    expect(rollout).toContain('DEPLOY_TRANSPORT=ssm|local');
    expect(rollout).toContain('aws ssm send-command');
    expect(rollout).toContain(
      'docker compose -f infra/deploy/docker-compose.api.yml up -d api nginx',
    );
    expect(smoke).toContain('/health /health/live /health/ready');
    expect(smoke).toContain('/internal/metrics');
    expect(smoke).toContain('Authorization: Bearer ${METRICS_BEARER_TOKEN}');
  });

  it('documents OIDC/environment setup, release runbook, and production policy without plan-only wording', () => {
    const oidcChecklist = readFileSync(join(awsRoot, 'github-actions-oidc-checklist.md'), 'utf8');
    const budgetChecklist = readFileSync(
      join(awsRoot, 'beginner-account-budget-checklist.md'),
      'utf8',
    );
    const runbook = readFileSync(join(runbooksRoot, 'api-production-deploy-runbook.md'), 'utf8');
    const deployReadme = readRepoFile('infra/deploy/README.md');
    const policy = readRepoFile('docs/04_policy/official/production-deployment-readiness.md');

    expect(oidcChecklist).toContain('token.actions.githubusercontent.com');
    expect(oidcChecklist).toContain('repo:<owner>/<repo>:environment:production');
    expect(oidcChecklist).toContain('AWS_ROLE_TO_ASSUME');
    expect(budgetChecklist).toContain('AWS Budgets');
    expect(runbook).toContain('API Production Deploy');
    expect(runbook).toContain('infra/deploy/scripts/api-release-smoke.sh');
    expect(deployReadme).toContain('.github/workflows/api-ci.yml');
    expect(deployReadme).toContain('.github/workflows/api-deploy-production.yml');
    expect(policy).toContain('GitHub production environment, OIDC role, release runbook');

    for (const doc of [oidcChecklist, budgetChecklist, runbook, deployReadme, policy]) {
      expect(doc).not.toMatch(/구현 예정|후속 Phase|이 plan|Phase 7에서/);
    }
  });
});
