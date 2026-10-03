import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('docs, infrastructure and repository scripts expose one root responsibility index each', () => {
  for (const path of ['docs/README.md', 'infra/README.md', 'scripts/README.md']) {
    assert.equal(existsSync(resolve(repoRoot, path)), true, `${path} is missing`);
  }
});

test('deploy assets own runtime candidates while local rehearsal remains a separate owner', () => {
  const deploy = read('infra/deploy/README.md');

  assert.match(deploy, /runtime candidate/u);
  assert.match(deploy, /infra\/rehearsal\/README\.md/u);
  assert.doesNotMatch(deploy, /local container rehearsal[^\n]*소유/u);
});

test('database and observability READMEs link procedures to their lifecycle runbook owners', () => {
  const database = read('infra/db/README.md');
  const observability = read('infra/observability/README.md');

  assert.match(database, /operator script/u);
  assert.match(database, /infra\/runbooks\/operations\/database\/backup-restore\.md/u);
  assert.match(observability, /configuration asset/u);
  assert.match(observability, /infra\/runbooks\/operations\/observability\/production-stack\.md/u);
  assert.match(observability, /infra\/rehearsal\/README\.md/u);
});

test('documentation and provider checklist indexes explain their non-overlapping boundaries', () => {
  const docsRunbooks = read('docs/runbooks/README.md');
  const observabilityRunbooks = read('docs/runbooks/observability/README.md');
  const aws = read('infra/aws/README.md');

  assert.match(docsRunbooks, /infra\/runbooks/u);
  assert.match(observabilityRunbooks, /제품·서비스/u);
  assert.match(observabilityRunbooks, /infra\/runbooks\/operations\/observability/u);
  assert.match(aws, /release-gated/u);
  assert.match(aws, /실제 target evidence/u);
});

test('human-facing agentic engineering methodology is discoverable without becoming an instruction owner', () => {
  const development = read('docs/development/README.md');
  const methodology = read('docs/evidence/agent-workflows/agentic-engineering-methodology.md');
  const rootReadme = read('README.md');

  assert.match(development, /agentic-engineering-methodology\.md/u);
  assert.match(rootReadme, /agentic-engineering-methodology\.md/u);
  for (const concept of [
    'Agentic Programming',
    'Harness Engineering',
    'Context Engineering',
    'Policy-first',
    'Contract-driven',
    'Evidence-driven',
    'Human-governed',
    'Full SDD',
    'Autonomous Software Factory',
    'Vibe Coding',
  ]) {
    assert.match(methodology, new RegExp(concept, 'u'));
  }
  assert.match(methodology, /human-to-human/u);
  assert.match(methodology, /AGENTS\.md.*instruction owner/u);
  assert.doesNotMatch(methodology, /\.omx\/plans/u);
  assert.doesNotMatch(methodology, /\bPhase\s+\d+(?:[.-]\d+)?\b/u);
});

test('owner cost documentation separates cash outflow from project-attributable cost', () => {
  const development = read('docs/development/README.md');
  const costIndex = read('docs/development/cost/README.md');
  const ledger = read('docs/development/cost/owner-monthly-costs.md');

  assert.match(development, /.\/cost\/README\.md/u);
  assert.match(costIndex, /owner-monthly-costs\.md/u);
  for (const phrase of [
    'GitHub Pro',
    'ChatGPT Pro',
    'Gross',
    'Personal baseline',
    'Project-attributable',
    '$104',
    '$84',
    '$18.860103243',
    '$0',
    'TBD',
  ]) {
    assert.match(ledger, new RegExp(phrase.replaceAll('$', '\\$'), 'u'));
  }
  assert.match(ledger, /Card number.*commit하지 않습니다/su);
  assert.doesNotMatch(
    ledger,
    /(?:card number|invoice ID|billing address|tax identifier|credential value)\s*[:=]\s*\S+/iu,
  );
  assert.doesNotMatch(ledger, /\.omx\/plans/u);
});
