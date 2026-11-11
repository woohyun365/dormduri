import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = resolve(fileURLToPath(new URL('.', import.meta.url)), 'ssm-send.sh');
const digest = (character) => `sha256:${character.repeat(64)}`;
const commandId = '0f8fad5b-d9cb-469f-a165-70867728950e';

// A fake aws CLI: send-command prints the command ID, list-commands prints the configured status row.
function run(args, status, { failOnce = false, document = 'dormduri-web-deploy' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'ssm-send-'));
  if (failOnce) writeFileSync(join(directory, 'fail-once'), '');
  const log = join(directory, 'aws.log');
  writeFileSync(
    join(directory, 'aws'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${log}"\ncase "$2" in\n  send-command) echo ${commandId} ;;\n  list-commands) if [ -e "${directory}/fail-once" ]; then rm "${directory}/fail-once"; exit 255; fi; printf '%s\\n' "$STUB_STATUS" ;;\nesac\n`,
  );
  chmodSync(join(directory, 'aws'), 0o755);
  const result = spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      DEPLOY_DOCUMENT: document,
      GITHUB_RUN_ID: '41573137218',
      STUB_STATUS: status,
      SSM_POLL_SECONDS: '0',
    },
  });
  let calls = '';
  try {
    calls = readFileSync(log, 'utf8');
  } catch {
    calls = '';
  }
  rmSync(directory, { recursive: true, force: true });
  return { ...result, calls };
}
const valid = ['deploy', digest('a'), digest('b'), 'c'.repeat(64)];

test('a command that succeeds on exactly one target passes and the command ID is masked, never printed', () => {
  const result = run(valid, 'Success\t1\t1\t0');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`^::add-mask::${commandId}$`, 'mu'));
  assert.equal(result.stdout.split(commandId).length - 1, 1, 'only the mask line holds the ID');
  assert.match(
    result.calls,
    /send-command --document-name dormduri-web-deploy --document-hash c{64} --document-hash-type Sha256 --targets Key=tag:dormduri-deploy-target,Values=user-app/u,
  );
  assert.match(
    result.calls,
    new RegExp(
      `--parameters \\{"action":\\["deploy"\\],"webDigest":\\["${digest('a')}"\\],"ingressDigest":\\["${digest('b')}"\\]\\}`,
      'u',
    ),
  );
  assert.match(result.calls, /list-commands --command-id/u);
  assert.doesNotMatch(result.calls, /command-invocation/u);
});

test('a failed status query is asked again instead of ending the wait', () => {
  const result = run(valid, 'Success\t1\t1\t0', { failOnce: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.match(/list-commands/gu).length, 2);
});

test('a success on no target, or a failed, timed out or cancelled command, fails', () => {
  for (const status of [
    'Success\t0\t0\t0',
    'Success\t2\t2\t0',
    'Failed\t1\t1\t1',
    'TimedOut\t1\t1\t1',
    'Cancelled\t1\t0\t0',
  ]) {
    assert.equal(run(valid, status).status, 1, status);
  }
});

test('an unknown action, a malformed digest or hash is refused before any AWS call', () => {
  for (const args of [
    ['restart', digest('a'), digest('b'), 'c'.repeat(64)],
    ['deploy', 'sha256:short', digest('b'), 'c'.repeat(64)],
    ['deploy', digest('a'), digest('b'), 'not-a-hash'],
  ]) {
    const result = run(args, 'Success\t1\t1\t0');
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.calls, '');
  }
});

// The API document takes the API pair under its own parameter names (production-api-baseline D-AB12); the document name
// decides the names, so a digest never reaches the other bundle's document.
test('the API document gets the API pair parameters and an unknown document is refused before any AWS call', () => {
  const api = run(valid, 'Success\t1\t1\t0', { document: 'dormduri-api-deploy' });
  assert.equal(api.status, 0, api.stderr);
  assert.match(
    api.calls,
    /send-command --document-name dormduri-api-deploy --document-hash c{64} --document-hash-type Sha256 --targets Key=tag:dormduri-deploy-target,Values=user-app/u,
  );
  assert.match(
    api.calls,
    new RegExp(
      `--parameters \\{"action":\\["deploy"\\],"apiDigest":\\["${digest('a')}"\\],"apiMigrateDigest":\\["${digest('b')}"\\]\\}`,
      'u',
    ),
  );
  assert.match(api.calls, /--comment api-cd 41573137218 deploy/u);
  assert.doesNotMatch(api.calls, /webDigest|ingressDigest/u);
  assert.match(
    api.stdout,
    /^sent deploy dormduri\/api@sha256:a{64} dormduri\/api-migrate@sha256:b{64}$/mu,
  );
  const web = run(valid, 'Success\t1\t1\t0');
  assert.match(web.calls, /--comment web-cd 41573137218 deploy/u);
  for (const document of ['dormduri-backoffice-deploy', '']) {
    const result = run(valid, 'Success\t1\t1\t0', { document });
    assert.equal(result.status, 2, document);
    assert.equal(result.calls, '');
  }
  const extra = run([...valid.slice(0, 3), digest('d'), valid[3]], 'Success\t1\t1\t0', {
    document: 'dormduri-api-deploy',
  });
  assert.equal(extra.status, 2, 'a digest count that differs from the document is refused');
  assert.equal(extra.calls, '');
});
