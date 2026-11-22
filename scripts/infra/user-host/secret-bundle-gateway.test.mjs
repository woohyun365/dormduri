// 관측 secret 설치기(infra/deploy/user/api/ssm/secret_bundle.py `observability`)가 수신 gateway 접근 include를 쓰는 규칙
// (backoffice-foundation D-BF15): 선택 key 둘이 함께 있으면 그 사설 /32와 Bearer token만 받고, 둘 다 없으면 모두 거부하고, 하나만
// 있거나 값이 nginx 설정을 바꿀 수 있는 모양이면 묶음 전체를 거부한다(파일을 남기지 않는다).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const script = resolve(repoRoot, 'infra/deploy/user/api/ssm/secret_bundle.py');
const contract = resolve(repoRoot, 'infra/deploy/api/secret-mount.contract.json');
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEF0123456789_-';
const base = {
  GRAFANA_ADMIN_PASSWORD: 'fixture-grafana',
  SLACK_ALERT_WEBHOOK_URL: 'https://hooks.slack.invalid/x',
};

function install(bundle) {
  const directory = mkdtempSync(join(tmpdir(), 'secret-bundle-gateway-'));
  try {
    const result = spawnSync('python3', ['-I', script, 'observability', contract, directory], {
      input: JSON.stringify(bundle),
      encoding: 'utf8',
    });
    const files = readdirSync(directory).sort();
    const access = files.includes('gateway-access.conf')
      ? readFileSync(join(directory, 'gateway-access.conf'), 'utf8')
      : null;
    return { status: result.status, stderr: result.stderr, files, access };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('without the backoffice keys the gateway include denies every sender and token', () => {
  const { status, files, access } = install(base);
  assert.equal(status, 0);
  assert.deepEqual(files, ['gateway-access.conf', 'grafana-admin-password', 'slack-webhook-url']);
  assert.match(access, /^geo \$dormduri_backoffice_peer \{\n {2}default 0;\n\}$/mu);
  assert.match(
    access,
    /^map \$http_authorization \$dormduri_backoffice_token \{\n {2}default 0;\n\}$/mu,
  );
  assert.doesNotMatch(access, / 1;/u);
});

test('with both keys the include allows only that private /32 and a case-sensitive Bearer token', () => {
  const { status, access } = install({
    ...base,
    BACKOFFICE_HOST_PRIVATE_IP: '172.26.0.10',
    BACKOFFICE_INGEST_TOKEN: TOKEN,
  });
  assert.equal(status, 0);
  assert.match(access, /^ {2}172\.26\.0\.10\/32 1;$/mu);
  assert.ok(access.includes(`  "~^Bearer ${TOKEN}$" 1;\n`));
  assert.equal((access.match(/ 1;/gu) ?? []).length, 2);
});

test('one key alone, a public or malformed address, or a token that could change the config refuses the bundle', () => {
  for (const extra of [
    { BACKOFFICE_INGEST_TOKEN: TOKEN },
    { BACKOFFICE_HOST_PRIVATE_IP: '10.0.0.5' },
    { BACKOFFICE_HOST_PRIVATE_IP: '8.8.8.8', BACKOFFICE_INGEST_TOKEN: TOKEN },
    { BACKOFFICE_HOST_PRIVATE_IP: '127.0.0.1', BACKOFFICE_INGEST_TOKEN: TOKEN },
    { BACKOFFICE_HOST_PRIVATE_IP: '10.0.0.0/8', BACKOFFICE_INGEST_TOKEN: TOKEN },
    { BACKOFFICE_HOST_PRIVATE_IP: '10.0.0.5; allow all', BACKOFFICE_INGEST_TOKEN: TOKEN },
    { BACKOFFICE_HOST_PRIVATE_IP: '10.0.0.5', BACKOFFICE_INGEST_TOKEN: 'short' },
    { BACKOFFICE_HOST_PRIVATE_IP: '10.0.0.5', BACKOFFICE_INGEST_TOKEN: `${TOKEN}" 1; default 1;` },
    { BACKOFFICE_HOST_PRIVATE_IP: '10.0.0.5', BACKOFFICE_INGEST_TOKEN: `${TOKEN}\n` },
    { OTHER_KEY: 'x' },
  ]) {
    const { status, files } = install({ ...base, ...extra });
    assert.equal(status, 65, JSON.stringify(extra));
    assert.deepEqual(files, [], 'a refused bundle leaves no file');
  }
});
