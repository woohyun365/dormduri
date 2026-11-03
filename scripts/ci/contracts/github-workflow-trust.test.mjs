import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const workflowDirectory = resolve(repoRoot, '.github/workflows');
const workflowFiles = readdirSync(workflowDirectory)
  .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
  .sort();

function readWorkflow(fileName) {
  return readFileSync(resolve(workflowDirectory, fileName), 'utf8');
}

function externalActionReferences(source) {
  return [...source.matchAll(/^\s*-?\s*uses:\s*([^\s@]+)@([^\s#]+)/gmu)]
    .filter(([, owner]) => !owner.startsWith('./'))
    .map(([, owner, reference]) => ({ owner, reference }));
}

function checkoutBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes('uses: actions/checkout@')) continue;

    const indent = line.search(/\S/u);
    const block = [line];
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      const nextIndent = nextLine.search(/\S/u);
      if (nextLine.trim() && nextIndent >= 0 && nextIndent < indent) break;
      block.push(nextLine);
    }
    blocks.push(block.join('\n'));
  }

  return blocks;
}

function checkoutPersistsCredentials(block) {
  return !/^\s+persist-credentials:\s+false\s*$/mu.test(block);
}

function usesLiteralRepositoryTemporaryPath(source) {
  return /\/tmp\/knu-[^\s'"`]+/u.test(source);
}

// Write scopes are allowed only in these jobs (production-web-baseline D-WB5): OIDC for the AWS roles, provenance
// attestation after approval, and the deploy tag and Release. Every other job and workflow stays read-only.
export const DESIGNATED_WRITE_SCOPES = Object.freeze({
  'web-cd.yml': {
    build: ['id-token'],
    deploy: ['id-token', 'attestations'],
    tag: ['id-token'],
    record: ['contents'],
  },
});

// Every `<scope>: write` line with the job whose permissions block holds it ('' outside a job permissions block).
export function writeScopeLines(source) {
  const found = [];
  let inJobs = false;
  let job = '';
  let inPermissions = false;
  for (const line of source.split('\n')) {
    if (/^jobs:\s*$/u.test(line)) inJobs = true;
    else if (/^\S/u.test(line)) inJobs = false;
    const jobName = inJobs ? /^ {2}([A-Za-z0-9_-]+):\s*$/u.exec(line)?.[1] : undefined;
    if (jobName) {
      job = jobName;
      inPermissions = false;
      continue;
    }
    if (inJobs && /^ {4}permissions:\s*$/u.test(line)) {
      inPermissions = true;
      continue;
    }
    if (inPermissions && !/^ {6}\S/u.test(line)) inPermissions = false;
    const write = /^\s+([a-z-]+):\s+write\s*$/u.exec(line);
    if (write) found.push({ job: inPermissions ? job : '', scope: write[1] });
  }
  return found;
}

export function undesignatedWriteScopes(fileName, source) {
  const allowed = DESIGNATED_WRITE_SCOPES[fileName] ?? {};
  return writeScopeLines(source).filter(
    ({ job, scope }) => !job || !(allowed[job] ?? []).includes(scope),
  );
}

function jobLevelFieldCount(source, field) {
  return [...source.matchAll(new RegExp(`^ {4}${field}:`, 'gmu'))].length;
}

test('external GitHub Actions stay pinned to immutable full commit SHAs', () => {
  for (const fileName of workflowFiles) {
    const references = externalActionReferences(readWorkflow(fileName));
    assert.ok(references.length > 0, `${fileName} must declare at least one external action`);
    for (const { owner, reference } of references) {
      assert.match(reference, /^[a-f0-9]{40}$/u, `${fileName}: ${owner}@${reference}`);
    }
  }
});

test('workflows retain explicit read-only permissions and bounded job timeouts', () => {
  for (const fileName of workflowFiles) {
    const source = readWorkflow(fileName);
    assert.match(source, /^permissions:\n\s+contents:\s+read\s*$/mu, fileName);
    assert.deepEqual(undesignatedWriteScopes(fileName, source), [], fileName);
    assert.equal(
      jobLevelFieldCount(source, 'runs-on'),
      jobLevelFieldCount(source, 'timeout-minutes'),
      `${fileName} must bound every runner job`,
    );
  }
});

test('workflows avoid privileged PR triggers and direct untrusted PR shell interpolation', () => {
  for (const fileName of workflowFiles) {
    const source = readWorkflow(fileName);
    assert.doesNotMatch(source, /^\s*pull_request_target:/mu, fileName);
    assert.doesNotMatch(
      source,
      /^\s*run:\s*.*\$\{\{\s*github\.(?:event|head_ref|base_ref)/gmu,
      fileName,
    );
  }
});

test('trust checks identify checkout credential persistence and literal temp paths', () => {
  const unsafeCheckout = `
      - name: Checkout
        uses: actions/checkout@${'a'.repeat(40)}
  `;
  const safeCheckout = `${unsafeCheckout.trimEnd()}
        with:
          persist-credentials: false
  `;

  assert.equal(checkoutPersistsCredentials(checkoutBlocks(unsafeCheckout)[0]), true);
  assert.equal(checkoutPersistsCredentials(checkoutBlocks(safeCheckout)[0]), false);
  assert.equal(usesLiteralRepositoryTemporaryPath('output=/tmp/knu-result.json'), true);
  assert.equal(usesLiteralRepositoryTemporaryPath('output=$RUNNER_TEMP/knu-result.json'), false);
});

test('checkout steps disable persisted credentials when workflows do not push', () => {
  for (const fileName of workflowFiles) {
    for (const block of checkoutBlocks(readWorkflow(fileName))) {
      assert.equal(checkoutPersistsCredentials(block), false, fileName);
    }
  }
});

test('workflow-generated temporary output uses the runner-owned temporary directory', () => {
  for (const fileName of workflowFiles) {
    assert.equal(usesLiteralRepositoryTemporaryPath(readWorkflow(fileName)), false, fileName);
  }
});

test('a write scope outside the designated web-cd jobs is rejected', () => {
  const workflow = (jobs) => `name: x\npermissions:\n  contents: read\njobs:\n${jobs}`;
  const job = (name, scopes) =>
    `  ${name}:\n    runs-on: ubuntu-26.04\n    permissions:\n${scopes
      .map((scope) => `      ${scope}\n`)
      .join('')}    steps:\n      - run: true\n`;
  const designated = workflow(
    [
      job('build', ['contents: read', 'id-token: write']),
      job('deploy', ['contents: read', 'id-token: write', 'attestations: write']),
      job('tag', ['contents: read', 'id-token: write']),
      job('record', ['contents: write']),
    ].join(''),
  );
  assert.deepEqual(undesignatedWriteScopes('web-cd.yml', designated), []);
  for (const [fileName, source, expected] of [
    ['ci.yml', designated, 5],
    ['web-cd.yml', workflow(job('build', ['contents: write'])), 1],
    ['web-cd.yml', workflow(job('smoke', ['id-token: write'])), 1],
    ['web-cd.yml', workflow(job('record', ['contents: write', 'packages: write'])), 1],
    [
      'web-cd.yml',
      `name: x\npermissions:\n  contents: write\njobs:\n${job('build', ['id-token: write'])}`,
      1,
    ],
  ]) {
    assert.equal(
      undesignatedWriteScopes(fileName, source).length,
      expected,
      `${fileName}\n${source}`,
    );
  }
});
