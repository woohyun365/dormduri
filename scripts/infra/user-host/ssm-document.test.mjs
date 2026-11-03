import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  ACTIONS,
  buildDocument,
  DIGEST_PATTERN,
  DOCUMENT_PATH,
  readSources,
} from './ssm-document.mjs';
import { PAGE_TITLES } from './ingress-smoke.mjs';

const repoRoot = process.cwd();
const committed = readFileSync(resolve(repoRoot, DOCUMENT_PATH), 'utf8');
const document = JSON.parse(committed);
const lines = document.mainSteps[0].inputs.runCommand;
// The first non-comment line matching a pattern.
const firstLine = (pattern) =>
  lines.findIndex((line) => !/^\s*#/u.test(line) && pattern.test(line));

test('the committed document is the generator output of deploy.sh and the host compose', () => {
  assert.equal(committed, buildDocument(readSources(repoRoot)));
});

test('the document takes only the action and a digest pair, each validated by SSM before the script runs', () => {
  assert.equal(document.schemaVersion, '2.2');
  assert.deepEqual(Object.keys(document.parameters).sort(), [
    'action',
    'ingressDigest',
    'webDigest',
  ]);
  for (const parameter of Object.values(document.parameters)) {
    assert.equal(parameter.type, 'String');
    // ENV_VAR keeps parameter values out of the script text, so a value cannot become shell syntax.
    assert.equal(parameter.interpolationType, 'ENV_VAR');
    assert.equal(parameter.default, undefined);
  }
  assert.deepEqual(document.parameters.action.allowedValues, [...ACTIONS]);
  assert.deepEqual(ACTIONS, ['deploy', 'rollback', 'maintenance']);
  for (const name of ['webDigest', 'ingressDigest']) {
    assert.equal(document.parameters[name].allowedPattern, DIGEST_PATTERN);
  }
  assert.equal(DIGEST_PATTERN, '^sha256:[a-f0-9]{64}$');
  const pattern = new RegExp(DIGEST_PATTERN, 'u');
  assert.ok(pattern.test(`sha256:${'a'.repeat(64)}`));
  for (const rejected of [
    `sha256:${'a'.repeat(63)}`,
    `sha256:${'A'.repeat(64)}`,
    `sha256:${'a'.repeat(64)};id`,
    'latest',
  ]) {
    assert.equal(pattern.test(rejected), false, rejected);
  }
});

test('the document runs one shell step on Linux and never takes free-form commands', () => {
  assert.equal(document.mainSteps.length, 1);
  assert.equal(document.mainSteps[0].action, 'aws:runShellScript');
  assert.deepEqual(document.mainSteps[0].precondition, { StringEquals: ['platformType', 'Linux'] });
  const body = lines.join('\n');
  assert.doesNotMatch(body, /\{\{|\}\}/u);
  assert.deepEqual([...new Set(body.match(/\bSSM_[A-Za-z]+/gu))].sort(), [
    'SSM_action',
    'SSM_ingressDigest',
    'SSM_webDigest',
  ]);
  assert.doesNotMatch(body, /\beval\b|bash -c|sh -c/u);
  assert.match(body, /^case "\$\{action\}" in deploy \| rollback \| maintenance\) ;; \*\)$/mu);
});

test('the script rejects input and takes the host lock before it touches Docker, AWS or the host state', () => {
  const actionCheck = firstLine(/^case "\$\{action\}" in deploy/u);
  const digestCheck = firstLine(
    /^if ! \[\[ \$\{web\} =~ \$\{digest_re\} && \$\{ingress\} =~ \$\{digest_re\} \]\]; then$/u,
  );
  const lock = firstLine(/^if ! flock -n 9; then$/u);
  const firstSideEffect = Math.min(
    ...[
      /\bdocker\b/u,
      /^\s*account=\$\(aws /u,
      /\baws ecr\b/u,
      /write_pair "/u,
      /cat >"\$\{compose_file\}\.tmp"/u,
    ]
      .map((pattern) => firstLine(pattern))
      .filter((index) => index >= 0),
  );
  assert.ok(
    actionCheck >= 0 && digestCheck > actionCheck && lock > digestCheck,
    'validation, then lock',
  );
  assert.ok(lock < firstSideEffect, 'the lock comes before Docker, AWS and state writes');
  assert.equal(lines[lock + 1].trim(), 'echo "RESULT=locked action=${action}"');
  assert.equal(lines[lock + 2].trim(), 'exit 75');
  assert.equal(lines[firstLine(/^exec 9>"\$\{state\}\/lock"$/u) + 1], lines[lock]);
});

test('the document carries the host compose it writes and keeps registry output in the root-only host log', () => {
  const body = lines.join('\n');
  assert.ok(body.includes(readSources(repoRoot).compose.trimEnd()), 'compose is embedded verbatim');
  assert.match(
    body,
    /docker compose -p "\$\{project\}" -f "\$\{compose_file\}" "\$@" >>"\$\{log\}" 2>&1/u,
  );
  assert.match(body, /^project=dormduri-web$/mu);
  // Standard output goes to SSM results that the deploy role reads: only RESULT lines and digests, never the registry.
  // say and fail print to standard output too, so every call of the four writers is checked.
  const writers = lines.filter((item) => /^\s*(?:echo|printf|say|fail)\b/u.test(item));
  assert.ok(
    writers.some((line) => /^\s*say\b/u.test(line)),
    'say lines are covered',
  );
  for (const line of writers) {
    assert.doesNotMatch(line, /registry|account|\$\(ref\b/u, line);
  }
});

test('the generator refuses bodies that would change meaning inside SSM or the heredoc', () => {
  const script = 'a\n#__COMPOSE_YML__\nb\n';
  assert.throws(() => buildDocument({ script: 'no marker', compose: 'x: 1\n' }), /marker/u);
  assert.throws(
    () => buildDocument({ script: `${script}${script}`, compose: 'x: 1\n' }),
    /marker/u,
  );
  assert.throws(() => buildDocument({ script, compose: 'x: 1\nCOMPOSE\n' }), /heredoc terminator/u);
  assert.throws(
    () => buildDocument({ script: `${script}echo {{ action }}\n`, compose: 'x: 1\n' }),
    /SSM parameter syntax/u,
  );
  assert.match(
    buildDocument({ script, compose: 'x: 1\n' }),
    /"runCommand": \[\n\s+"a",\n\s+"x: 1",\n\s+"b"\n/u,
  );
});

// The host smoke inside the document greps the static page titles. Their source is the page files, so a changed <title>
// must fail here, not on the host after the document is created.
test('the host smoke expects the page titles of the static page files', () => {
  const body = lines.join('\n');
  const functionBody = (name) => {
    const match = new RegExp(`^${name}\\(\\) \\{\\n([\\s\\S]*?)^\\}`, 'mu').exec(body);
    assert.ok(match, `${name} is defined`);
    return match[1];
  };
  const calls = (source) =>
    [...source.matchAll(/page_ok (\S+) (\d{3})(?: '([^']*)')?/gu)].map(([, path, code, title]) => ({
      path,
      code,
      title: title ?? null,
    }));
  assert.deepEqual(calls(functionBody('smoke_serving')), [
    { path: '/', code: '200', title: null },
    { path: '/privacy', code: '200', title: null },
    { path: '/terms', code: '200', title: null },
    { path: '/signup', code: '503', title: PAGE_TITLES.comingSoon },
    { path: '/__smoke_not_allowed', code: '404', title: PAGE_TITLES.notFound },
  ]);
  assert.deepEqual(calls(functionBody('smoke_maintenance')), [
    { path: '/', code: '503', title: PAGE_TITLES.maintenance },
    { path: '/privacy', code: '503', title: PAGE_TITLES.maintenance },
  ]);
});

// A successful rollback must not leave the pair it rolled away from as the next rollback target.
test('a successful rollback clears previous instead of recording the rolled-back pair', () => {
  const body = lines.join('\n');
  const rollback = /^  rollback\)\n([\s\S]*?)^    ;;/mu.exec(body);
  assert.ok(rollback, 'rollback case');
  assert.doesNotMatch(rollback[1], /write_pair "\$\{state\}\/previous"/u);
  assert.match(rollback[1], /rm -f "\$\{state\}\/previous"/u);
});
