import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  ACTIONS,
  API_DOCUMENT_NAME,
  API_DOCUMENT_PATH,
  buildApiDocument,
  buildDocument,
  DIGEST_PATTERN,
  DOCUMENT_NAME,
  DOCUMENT_PATH,
  DOCUMENT_SIZE_LIMIT,
  readApiSources,
  readSources,
  sha256,
} from './ssm-document.mjs';
import { PAGE_TITLES } from './ingress-smoke.mjs';

const repoRoot = process.cwd();
const load = (path) => {
  const committed = readFileSync(resolve(repoRoot, path), 'utf8');
  const document = JSON.parse(committed);
  const lines = document.mainSteps[0].inputs.runCommand;
  return { committed, document, lines, body: lines.join('\n') };
};
const web = load(DOCUMENT_PATH);
const api = load(API_DOCUMENT_PATH);
// The first non-comment line matching a pattern.
const firstLine = (lines, pattern) =>
  lines.findIndex((line) => !/^\s*#/u.test(line) && pattern.test(line));
const functionBody = (body, name) => {
  const match = new RegExp(`^${name}\\(\\) \\{\\n([\\s\\S]*?)^\\}`, 'mu').exec(body);
  assert.ok(match, `${name} is defined`);
  return match[1];
};
const caseBody = (body, name) => {
  const match = new RegExp(`^  ${name}\\)\\n([\\s\\S]*?)^    ;;`, 'mu').exec(body);
  assert.ok(match, `${name} case`);
  return match[1];
};

test('the committed documents are the generator output of their sources and fit the SSM size limit', () => {
  assert.equal(web.committed, buildDocument(readSources(repoRoot)));
  assert.equal(api.committed, buildApiDocument(readApiSources(repoRoot)));
  // Systems Manager quotas, Documents: "Document size 64 KB per document".
  assert.equal(DOCUMENT_SIZE_LIMIT, 65536);
  for (const { committed } of [web, api])
    assert.ok(Buffer.byteLength(committed) <= DOCUMENT_SIZE_LIMIT);
  assert.equal(DOCUMENT_NAME, 'dormduri-web-deploy');
  assert.equal(API_DOCUMENT_NAME, 'dormduri-api-deploy');
});

test('each document takes only the action and its digest pair, each validated by SSM before the script runs', () => {
  for (const [{ document }, digests] of [
    [web, ['ingressDigest', 'webDigest']],
    [api, ['apiDigest', 'apiMigrateDigest']],
  ]) {
    assert.equal(document.schemaVersion, '2.2');
    assert.deepEqual(Object.keys(document.parameters).sort(), ['action', ...digests]);
    for (const parameter of Object.values(document.parameters)) {
      assert.equal(parameter.type, 'String');
      // ENV_VAR keeps parameter values out of the script text, so a value cannot become shell syntax.
      assert.equal(parameter.interpolationType, 'ENV_VAR');
      assert.equal(parameter.default, undefined);
    }
    assert.deepEqual(document.parameters.action.allowedValues, [...ACTIONS]);
    for (const name of digests)
      assert.equal(document.parameters[name].allowedPattern, DIGEST_PATTERN);
  }
  assert.deepEqual(ACTIONS, ['deploy', 'rollback', 'maintenance']);
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

test('each document runs one shell step on Linux and never takes free-form commands', () => {
  for (const [{ document, body }, inputs] of [
    [web, ['SSM_action', 'SSM_ingressDigest', 'SSM_webDigest']],
    [api, ['SSM_action', 'SSM_apiDigest', 'SSM_apiMigrateDigest']],
  ]) {
    assert.equal(document.mainSteps.length, 1);
    assert.equal(document.mainSteps[0].action, 'aws:runShellScript');
    assert.deepEqual(document.mainSteps[0].precondition, {
      StringEquals: ['platformType', 'Linux'],
    });
    assert.doesNotMatch(body, /\{\{|\}\}/u);
    assert.deepEqual([...new Set(body.match(/\bSSM_[A-Za-z]+/gu))].sort(), inputs);
    assert.doesNotMatch(body, /\beval\b|bash -c|sh -c/u);
    assert.match(body, /^case "\$\{action\}" in deploy \| rollback \| maintenance\) ;; \*\)$/mu);
  }
});

test('each script rejects input and takes the shared host lock before it touches Docker, AWS or the host state', () => {
  for (const [{ lines }, digestCheck] of [
    [
      web,
      /^if ! \[\[ \$\{web\} =~ \$\{digest_re\} && \$\{ingress\} =~ \$\{digest_re\} \]\]; then$/u,
    ],
    [
      api,
      /^if ! \[\[ \$\{api\} =~ \$\{digest_re\} && \$\{api_migrate\} =~ \$\{digest_re\} \]\]; then$/u,
    ],
  ]) {
    const actionCheck = firstLine(lines, /^case "\$\{action\}" in deploy/u);
    const digest = firstLine(lines, digestCheck);
    const lock = firstLine(lines, /^if ! flock -n 9; then$/u);
    const firstSideEffect = Math.min(
      ...[
        /\bdocker\b/u,
        /\baws (?:sts|ecr|secretsmanager)\b/u,
        /^\s*(?:registry_init|adopt_legacy_web_records|ensure_api_transit)$/u,
        /record_put "/u,
        /cat >"\$\{(?:new_dir|tools)\}/u,
      ]
        .map((pattern) => firstLine(lines, pattern))
        .filter((index) => index >= 0),
    );
    assert.ok(actionCheck >= 0 && digest > actionCheck && lock > digest, 'validation, then lock');
    assert.ok(lock < firstSideEffect, 'the lock comes before Docker, AWS and state writes');
    assert.equal(lines[lock + 1].trim(), 'echo "RESULT=locked action=${action}"');
    assert.equal(lines[lock + 2].trim(), 'exit 75');
    // Both documents share one host lock file.
    assert.equal(lines[firstLine(lines, /^exec 9>"\$\{state\}\/lock"$/u) + 1], lines[lock]);
  }
  for (const { body } of [web, api]) assert.match(body, /^state=\$\{base\}\/state$/mu);
});

test('the documents carry their fragments and the shared library, and keep registry output in the root-only host log', () => {
  const webSources = readSources(repoRoot);
  const apiSources = readApiSources(repoRoot);
  assert.ok(web.body.includes(webSources.compose.trimEnd()), 'web fragment is embedded verbatim');
  assert.ok(api.body.includes(apiSources.compose.trimEnd()), 'API fragment is embedded verbatim');
  assert.ok(api.body.includes(apiSources.secretBundle.trimEnd()), 'secret installer is embedded');
  assert.ok(api.body.includes(apiSources.contract.trimEnd()), 'secret contract is embedded');
  for (const { body } of [web, api]) {
    assert.ok(body.includes(webSources.lib.trimEnd()), 'the shared library is embedded verbatim');
    assert.match(body, /^project=dormduri-web$/mu);
    // Every compose call goes through run_compose with the one project name.
    assert.match(body, /docker compose -p "\$\{project\}" "\$@" >>"\$\{log\}" 2>&1/u);
    assert.equal(body.match(/docker compose /gu).length, 1, 'one compose call site');
    assert.doesNotMatch(body, /run_compose[^\n]* down\b/u, 'no project-wide down');
    const lines = body.split('\n');
    // Standard output goes to SSM results that the deploy role reads: only RESULT lines and digests, never the registry.
    const writers = lines.filter((item) => /^\s*(?:echo|printf|say|fail)\b/u.test(item));
    assert.ok(
      writers.some((line) => /^\s*say\b/u.test(line)),
      'say lines are covered',
    );
    for (const line of writers) assert.doesNotMatch(line, /registry|account|\$\(ref\b/u, line);
  }
  // documentSource is the hash of the sources, so the host record names the source of each release.
  assert.match(
    web.body,
    new RegExp(`^document_source=${sha256(JSON.stringify(webSources))}$`, 'mu'),
  );
  assert.match(
    api.body,
    new RegExp(`^document_source=${sha256(JSON.stringify(apiSources))}$`, 'mu'),
  );
});

test('the generator refuses bodies that would change meaning inside SSM or a heredoc', () => {
  const script =
    'a\n#__USER_HOST_LIB__\ndocument_source=__DOCUMENT_SOURCE_SHA256__\n#__COMPOSE_YML__\nb\n';
  const ok = { script, lib: 'lib', compose: 'x: 1\n' };
  assert.throws(() => buildDocument({ ...ok, script: 'no marker' }), /marker/u);
  assert.throws(() => buildDocument({ ...ok, script: `${script}${script}` }), /marker/u);
  assert.throws(() => buildDocument({ ...ok, compose: 'x: 1\nCOMPOSE\n' }), /heredoc terminator/u);
  assert.throws(() => buildDocument({ ...ok, lib: 'echo {{ action }}' }), /SSM parameter syntax/u);
  assert.match(buildDocument(ok), /"runCommand": \[\n\s+"a",\n\s+"lib",\n/u);
  const apiScript = `${script}#__SECRET_BUNDLE_PY__\n#__SECRET_CONTRACT_JSON__\n`;
  const apiOk = { ...ok, script: apiScript, secretBundle: 'print(1)\n', contract: '{}\n' };
  assert.throws(
    () => buildApiDocument({ ...apiOk, secretBundle: 'print(1)\nPY\n' }),
    /heredoc terminator line PY/u,
  );
  assert.throws(
    () => buildApiDocument({ ...apiOk, contract: '{}\nJSON\n' }),
    /heredoc terminator line JSON/u,
  );
  // A `$` sequence in a source stays literal (String.replace patterns are not applied).
  assert.match(buildDocument({ ...ok, lib: 'echo "$\'" "$&"' }), /echo \\"\$'\\" \\"\$&\\"/u);
});

// The host smoke inside the web document greps the static page titles. Their source is the page files, so a changed
// <title> must fail here, not on the host after the document is created.
test('the web host smoke expects the page titles of the static page files', () => {
  const calls = (source) =>
    [...source.matchAll(/page_ok (\S+) (\d{3})(?: '([^']*)')?/gu)].map(([, path, code, title]) => ({
      path,
      code,
      title: title ?? null,
    }));
  assert.deepEqual(calls(functionBody(web.body, 'smoke_serving')), [
    { path: '/', code: '200', title: null },
    { path: '/privacy', code: '200', title: null },
    { path: '/terms', code: '200', title: null },
    { path: '/signup', code: '503', title: PAGE_TITLES.comingSoon },
    { path: '/__smoke_not_allowed', code: '404', title: PAGE_TITLES.notFound },
  ]);
  assert.deepEqual(calls(functionBody(web.body, 'smoke_maintenance')), [
    { path: '/', code: '503', title: PAGE_TITLES.maintenance },
    { path: '/privacy', code: '503', title: PAGE_TITLES.maintenance },
  ]);
});

// A successful rollback must not leave the release it rolled away from as the next rollback target.
test('a successful rollback clears previous instead of recording the rolled-back release', () => {
  for (const [{ body }, state] of [
    [web, 'web_state'],
    [api, 'api_state'],
  ]) {
    const rollback = caseBody(body, 'rollback');
    assert.doesNotMatch(rollback, new RegExp(`record_put "\\$\\{${state}\\}/previous"`, 'u'));
    assert.match(rollback, new RegExp(`rm -f [^\\n]*"\\$\\{${state}\\}/previous"`, 'u'));
  }
});

test('web bundle calls name only web bundle services and keep the old web network definition untouched', () => {
  const calls = [...web.body.matchAll(/run_compose ([^\n|]*)/gu)].map((match) => match[1]);
  assert.ok(calls.length >= 4);
  for (const call of calls) {
    if (/^"\$@"|^\$/u.test(call)) continue;
    assert.doesNotMatch(call, /\bapi\b|\bmigrate\b/u, call);
  }
  assert.match(functionBody(web.body, 'enter_maintenance'), /run_compose stop web ingress/u);
  assert.match(functionBody(web.body, 'enter_maintenance'), /run_compose rm -f web ingress/u);
  // `--remove-orphans` only when both fragments are passed.
  assert.match(functionBody(web.body, 'start_record'), /run_compose up -d \$\(orphan_flag\) /u);
});

test('the API document guards the web record, fetches secrets only through a pipe and orders migrate before rollout', () => {
  const lines = api.lines;
  const guard = firstLine(
    lines,
    /record_is_current_format "\$\{web_record\}" \|\| fail web-record-legacy 2/u,
  );
  const fetch = firstLine(lines, /aws secretsmanager get-secret-value/u);
  const registry = firstLine(lines, /^registry_init$/u);
  assert.ok(guard >= 0 && guard < registry && guard < fetch, 'the web record guard comes first');
  // Secret values never sit in a shell variable or argument: the JSON goes from the CLI straight into python3.
  assert.doesNotMatch(api.body, /=\$\(aws secretsmanager|=\$\(secret_json/u);
  assert.match(api.body, /secret_json "\$\{runtime_secret\}" \| secret_py install /u);
  assert.match(api.body, /secret_json "\$\{migration_secret\}" \\\n\s+\| secret_py extract /u);
  assert.match(api.body, /^runtime_secret=\/dormduri\/production\/api\/runtime$/mu);
  assert.match(api.body, /^migration_secret=\/dormduri\/production\/api\/migration$/mu);
  const migrate = functionBody(api.body, 'run_migrate');
  assert.match(migrate, /for step in migrate grant smoke outbox; do/u);
  assert.match(migrate, /run_compose --profile migrate run --rm --no-deps migrate "\$\{step\}"/u);
  const rollout = functionBody(api.body, 'rollout_record');
  const stop = rollout.indexOf('run_compose stop api');
  const remove = rollout.indexOf('run_compose rm -f api');
  const start = rollout.indexOf('run_compose up -d --no-deps --wait');
  assert.ok(
    stop >= 0 && stop < remove && remove < start,
    'the old API stops before the new one starts',
  );
  assert.match(rollout, /host_smoke$/mu);
  const deploy = caseBody(api.body, 'deploy');
  assert.ok(
    deploy.indexOf('run_migrate') < deploy.indexOf('rollout_record'),
    'migrate before rollout',
  );
  assert.doesNotMatch(caseBody(api.body, 'rollback'), /run_migrate/u, 'rollback skips migrate');
  assert.match(
    caseBody(api.body, 'rollback'),
    /install_runtime_secret/u,
    'rollback re-fetches the secret',
  );
  // The host smoke reaches the private listener from inside the Web container, not a container on the Web transit.
  assert.match(functionBody(api.body, 'host_smoke'), /run_compose exec -T web node -e /u);
  assert.doesNotMatch(api.body, /docker run\b/u);
});
