import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const reportTemplatePath = join(process.cwd(), 'test/stress/evidence/renderers/report-template.md');
const runbookPath = join(
  process.cwd(),
  '../../docs/runbooks/observability/api-stress-release-runbook.md',
);

const rawSecretValuePatterns = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/u,
  /Basic\s+[A-Za-z0-9._~+/=-]{8,}/u,
  /(?:access|refresh|session|jwt|sid)=\S{8,}/iu,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
];

describe('stress release report template', () => {
  it('documents safe release metadata, parser summaries, observability readout, and cleanup evidence', () => {
    const template = readFileSync(reportTemplatePath, 'utf8');

    expect(template).toContain('## 1. Run metadata');
    expect(template).toContain('## 3. Safety checklist');
    expect(template).toContain('## 6. k6 safe parser summary');
    expect(template).toContain('## 7. Artillery safe parser summary');
    expect(template).toContain('## 8. Observability readout');
    expect(template).toContain('Fixture reset completed');
    expect(template).toContain('Raw token/ticket/cookie/password/email omitted');
  });

  it('does not include raw secret-looking examples in the template or runbook', () => {
    const source = [
      readFileSync(reportTemplatePath, 'utf8'),
      readFileSync(runbookPath, 'utf8'),
    ].join('\n');

    for (const pattern of rawSecretValuePatterns) {
      expect(source).not.toMatch(pattern);
    }
  });
});
