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
