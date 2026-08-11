import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');

describe('observability release evidence', () => {
  it('keeps credential lifecycle metrics in release smoke and runbook evidence', () => {
    const smoke = readFileSync(join(repoRoot, 'infra/deploy/scripts/api-release-smoke.sh'), 'utf8');
    const runbookPath = join(
      repoRoot,
      'infra/runbooks/auth-registration-credential-release-evidence.md',
    );
    expect(existsSync(runbookPath)).toBe(true);
    for (const metric of [
      'api_auth_signup_nickname_validation_total',
      'api_auth_signup_final_admission_total',
      'api_auth_signup_password_hash_duration_seconds',
      'api_auth_sensitive_mutations_total',
    ]) {
      expect(smoke).toContain(metric);
    }
    const runbook = readFileSync(runbookPath, 'utf8');
    expect(runbook).toContain('auth/auth-lifecycle.integration.spec.ts');
    expect(runbook).toContain('argon_19mib_mixed_workload: pass | fail | blocked');
  });

  it('keeps stress and Slack evidence reproducible without secrets', () => {
    const stressRunbook = readFileSync(
      join(repoRoot, 'docs/runbooks/observability/api-stress-release-runbook.md'),
      'utf8',
    );
    const report = readFileSync(
      join(apiRoot, 'test/stress/evidence/renderers/report-template.md'),
      'utf8',
    );
    const slackRunbook = readFileSync(
      join(repoRoot, 'docs/runbooks/observability/slack-alert-runbook.md'),
      'utf8',
    );
    expect(stressRunbook).toContain('STRESS_ALLOWED_HOSTS');
    expect(stressRunbook).toContain('stress:fixture:reset');
    expect(report).toContain('Raw token/ticket/cookie/password/email omitted');
    expect(slackRunbook).toContain('Payload privacy');
  });

  it('keeps the local observability rehearsal sequence discoverable', () => {
    const checklist = readFileSync(
      join(repoRoot, 'infra/observability/rehearsal-checklist.md'),
      'utf8',
    );
    expect(checklist).toContain('pnpm infra:compose -- api-stress');
    expect(checklist).toContain('pnpm infra:compose -- observability-rehearsal');
    expect(checklist).toContain('/health/ready');
    expect(checklist).toContain('/internal/metrics');
    expect(checklist).toContain('stress:docker:smoke');
  });
});
