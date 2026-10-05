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
    assert.doesNotMatch(source, /^\s+[a-z-]+:\s+write\s*$/gmu, fileName);
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
