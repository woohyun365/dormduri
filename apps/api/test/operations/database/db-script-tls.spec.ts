import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = join(process.cwd(), '../..');
const dbRoot = join(repoRoot, 'infra/db');
const ROOT_CA = '/etc/dormduri/rds-ca/root.pem';
const HOST = 'db.invalid:5432/dormduri';
// Stored URL forms (D-AB5, B2 G3): Prisma CLI form B for the migration secret, libpq verify-full for runtime users.
const PRISMA_FORM_B = `postgresql://dormduri_migrator:pw@${HOST}?sslmode=require&sslcert=${ROOT_CA}&sslaccept=strict`;
const runtimeUrl = (user: string) =>
  `postgresql://${user}:pw@${HOST}?sslmode=verify-full&sslrootcert=${ROOT_CA}`;
const RUNTIME_URLS = {
  DATABASE_URL: runtimeUrl('dormduri_api'),
  RETENTION_WORKER_DATABASE_URL: runtimeUrl('dormduri_retention_worker'),
  RETENTION_DISCLOSURE_DATABASE_URL: runtimeUrl('dormduri_api_disclosure'),
};
const LAST_MIGRATION = readdirSync(join(repoRoot, 'packages/database/prisma/migrations'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .at(-1);

// psql stand-in: records the URL and the libpq TLS env of every call, and answers the queries the DB scripts send.
const FAKE_PSQL = `#!/bin/sh
url=$1
shift
printf 'url=%s mode=%s root=%s\\n' "$url" "\${PGSSLMODE-}" "\${PGSSLROOTCERT-}" >>"$FAKE_PSQL_LOG"
query=
while [ "$#" -gt 0 ]; do
  case "$1" in -c) query=$2; shift 2 ;; *) shift ;; esac
done
user=\${url#*://}
user=\${user%%[:@]*}
case "$query" in
  *server_version_num*) echo 180006 ;;
  *_prisma_migrations*) echo "$FAKE_LAST_MIGRATION" ;;
  *pgaudit*) echo "$FAKE_PGAUDIT" ;;
  'SELECT current_user')
    if [ "$user" = dormduri_migrator ]; then echo migration_owner; else echo "$user"; fi ;;
  *'"RetainedIdentity" LIMIT 0'*)
    if [ "$user" = dormduri_api ]; then echo 'ERROR:  permission denied for table RetainedIdentity'; exit 1; fi ;;
  *'"SupportTicket" LIMIT 0'*)
    if [ "$user" = dormduri_retention_worker ]; then echo 'ERROR:  permission denied for table SupportTicket'; exit 1; fi ;;
  *'"User" LIMIT 0'*)
    if [ "$user" = dormduri_api_disclosure ]; then echo 'ERROR:  permission denied for table User'; exit 1; fi ;;
esac
exit 0
`;

let directory: string | undefined;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

function run(script: string, env: Record<string, string>) {
  directory = mkdtempSync(join(tmpdir(), 'db-script-tls-'));
  const log = join(directory, 'psql.log');
  writeFileSync(join(directory, 'psql'), FAKE_PSQL);
  chmodSync(join(directory, 'psql'), 0o755);
  writeFileSync(log, '');
  const result = spawnSync('sh', [join(dbRoot, script)], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      PATH: `${directory}:${process.env.PATH ?? ''}`,
      FAKE_PSQL_LOG: log,
      FAKE_LAST_MIGRATION: LAST_MIGRATION ?? '',
      FAKE_PGAUDIT: 't',
      ...env,
    },
  });
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = /^url=(\S*) mode=(\S*) root=(\S*)$/u.exec(line);
      return { url: match?.[1], mode: match?.[2], root: match?.[3] };
    });
  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
}

describe('infra/db psql TLS arguments (D-AB5 form C)', () => {
  it('Prisma 형식 B의 migration URL은 TLS 인자를 떼고 PGSSLMODE=verify-full·PGSSLROOTCERT로 psql을 부른다', () => {
    const result = run('apply-role-grants.sh', { MIGRATION_DATABASE_URL: PRISMA_FORM_B });

    expect(result.status, result.output).toBe(0);
    expect(result.calls).toEqual([
      { url: `postgresql://dormduri_migrator:pw@${HOST}`, mode: 'verify-full', root: ROOT_CA },
    ]);
    expect(result.output).not.toContain('pw@');
  });

  it('runtime verify-full URL도 같은 형식으로 psql에 넘기고 다른 query 인자는 그대로 둔다', () => {
    const result = run('smoke-role-grants.sh', {
      MIGRATION_DATABASE_URL: `${PRISMA_FORM_B}&connect_timeout=10`,
      ...RUNTIME_URLS,
    });

    expect(result.status, result.output).toBe(0);
    expect(result.calls.length).toBeGreaterThan(4);
    for (const call of result.calls) {
      expect(call.url).not.toMatch(/ssl/u);
      expect(call.mode).toBe('verify-full');
      expect(call.root).toBe(ROOT_CA);
    }
    expect(result.calls.at(-1)?.url).toBe(
      `postgresql://dormduri_migrator:pw@${HOST}?connect_timeout=10`,
    );
  });

  it('TLS 인자가 없는 local URL은 그대로 넘기고 libpq TLS env를 정하지 않는다', () => {
    const local = 'postgresql://dormduri_migrator:pw@localhost:5432/dormduri';
    const result = run('apply-role-grants.sh', { MIGRATION_DATABASE_URL: local });

    expect(result.status, result.output).toBe(0);
    expect(result.calls).toEqual([{ url: local, mode: '', root: '' }]);
  });

  // libpq는 모르는 query 인자를 거부한다("invalid URI query parameter"). Prisma URL에 흔한 인자는 TLS 여부와 관계없이 뗀다.
  it('Prisma 전용 query 인자(schema 등)는 psql에 넘기지 않고 libpq 인자는 남긴다', () => {
    const prismaOnly =
      'schema=public&connection_limit=5&pool_timeout=10&pgbouncer=true&statement_cache_size=0&socket_timeout=5';
    const tls = run('apply-role-grants.sh', {
      MIGRATION_DATABASE_URL: `${PRISMA_FORM_B}&${prismaOnly}&connect_timeout=10`,
    });
    expect(tls.status, tls.output).toBe(0);
    expect(tls.calls).toEqual([
      {
        url: `postgresql://dormduri_migrator:pw@${HOST}?connect_timeout=10`,
        mode: 'verify-full',
        root: ROOT_CA,
      },
    ]);

    const local = run('apply-role-grants.sh', {
      MIGRATION_DATABASE_URL: `postgresql://dormduri_migrator:pw@localhost:5432/dormduri?${prismaOnly}`,
    });
    expect(local.status, local.output).toBe(0);
    expect(local.calls).toEqual([
      { url: 'postgresql://dormduri_migrator:pw@localhost:5432/dormduri', mode: '', root: '' },
    ]);
  });

  it('서버 인증서를 검증하지 않는 형식(sslmode=require만, 검증을 건너뛰는 Prisma 인자)은 psql을 부르기 전에 멈춘다', () => {
    for (const url of [
      `postgresql://dormduri_migrator:pw@${HOST}?sslmode=require`,
      `postgresql://dormduri_migrator:pw@${HOST}?sslmode=prefer`,
      `postgresql://dormduri_migrator:pw@${HOST}?sslmode=require&sslcert=${ROOT_CA}&sslaccept=accept_invalid_certs`,
    ]) {
      const result = run('apply-role-grants.sh', { MIGRATION_DATABASE_URL: url });
      expect(result.status, url).toBe(64);
      expect(result.calls, url).toEqual([]);
      expect(result.output, url).not.toContain('pw@');
    }
  });
});

// migrate image entrypoint(운영 one-off): local·CI용 "TLS 인자 없는 URL은 호출자 libpq env 그대로"를 쓰지 않는다. 네 URL이
// 서버 인증서와 host 이름을 검증하는 형식인지 secret을 읽을 때 보고, migration URL은 Prisma CLI가 검증하는 형식 B만 받는다.
function runEntrypoint(step: string, secrets: Record<string, string>) {
  directory = mkdtempSync(join(tmpdir(), 'migrate-entrypoint-'));
  const log = join(directory, 'psql.log');
  const secretDirectory = join(directory, 'secrets');
  writeFileSync(join(directory, 'psql'), FAKE_PSQL);
  chmodSync(join(directory, 'psql'), 0o755);
  writeFileSync(log, '');
  mkdirSync(secretDirectory);
  for (const [key, value] of Object.entries(secrets))
    writeFileSync(join(secretDirectory, key), value);
  const result = spawnSync('sh', [join(repoRoot, 'infra/deploy/api/migrate-entrypoint.sh'), step], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      PATH: `${directory}:${process.env.PATH ?? ''}`,
      FAKE_PSQL_LOG: log,
      FAKE_LAST_MIGRATION: LAST_MIGRATION ?? '',
      FAKE_PGAUDIT: 't',
      MIGRATE_SECRET_DIRECTORY: secretDirectory,
      MIGRATE_DB_SCRIPTS: dbRoot,
    },
  });
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
}

describe('migrate image entrypoint TLS 강제 (D-AB5)', () => {
  const local = (user: string) => `postgresql://${user}:pw@${HOST}`;

  it('migration URL이 형식 B면 grant 단계가 verify-full로 psql을 부른다', () => {
    const result = runEntrypoint('grant', { MIGRATION_DATABASE_URL: PRISMA_FORM_B });

    expect(result.status, result.output).toBe(0);
    expect(result.calls).toEqual([
      `url=postgresql://dormduri_migrator:pw@${HOST} mode=verify-full root=${ROOT_CA}`,
    ]);
  });

  it('TLS 인자가 없거나 Prisma가 검증하지 않는 형식의 migration URL은 어느 단계도 client를 부르지 않고 64로 끝난다', () => {
    for (const step of ['migrate', 'grant', 'smoke', 'outbox', 'restore-drill']) {
      for (const url of [
        local('dormduri_migrator'),
        `${local('dormduri_migrator')}?schema=public`,
        runtimeUrl('dormduri_migrator'),
        `${local('dormduri_migrator')}?sslmode=require`,
      ]) {
        const result = runEntrypoint(step, { MIGRATION_DATABASE_URL: url, ...RUNTIME_URLS });
        expect(result.status, `${step} ${url}`).toBe(64);
        expect(result.calls, `${step} ${url}`).toEqual([]);
        expect(result.output).toContain('MIGRATION_DATABASE_URL');
        expect(result.output).not.toContain('pw@');
      }
    }
  });

  it('role smoke는 runtime URL 셋도 검증 형식이어야 한다', () => {
    const result = runEntrypoint('smoke', {
      MIGRATION_DATABASE_URL: PRISMA_FORM_B,
      ...RUNTIME_URLS,
      RETENTION_WORKER_DATABASE_URL: local('dormduri_retention_worker'),
    });

    expect(result.status, result.output).toBe(64);
    expect(result.calls).toEqual([]);
    expect(result.output).toContain('RETENTION_WORKER_DATABASE_URL');
    expect(result.output).not.toContain('pw@');

    const verified = runEntrypoint('smoke', {
      MIGRATION_DATABASE_URL: PRISMA_FORM_B,
      ...RUNTIME_URLS,
    });
    expect(verified.status, verified.output).toBe(0);
  });

  // restore drill(user host의 migrate image one-off): host role이 꺼낸 묶음의 URL 넷(host만 복원 endpoint)을 smoke와 같은
  // 형식 검사로 읽어 RESTORE_DRILL_* 이름으로 restore-drill-smoke.sh에 넘긴다. 노트북에 production credential을 두지 않는다.
  it('restore-drill 단계는 같은 URL 넷을 검증 형식으로 읽고 PostgreSQL major·마지막 migration·pgaudit 뒤 role smoke를 한다', () => {
    const result = runEntrypoint('restore-drill', {
      MIGRATION_DATABASE_URL: PRISMA_FORM_B,
      ...RUNTIME_URLS,
    });

    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(`restore drill last migration verified: ${LAST_MIGRATION}`);
    expect(result.output).toContain('restore drill pgaudit verified');
    expect(result.output).toContain('role grant smoke complete');
    expect(result.output).not.toContain('pw@');
    for (const call of result.calls)
      expect(call).toMatch(/ mode=verify-full root=\/etc\/dormduri\/rds-ca\/root\.pem$/u);

    const weakRuntime = runEntrypoint('restore-drill', {
      MIGRATION_DATABASE_URL: PRISMA_FORM_B,
      ...RUNTIME_URLS,
      RETENTION_DISCLOSURE_DATABASE_URL: local('dormduri_api_disclosure'),
    });
    expect(weakRuntime.status).toBe(64);
    expect(weakRuntime.calls).toEqual([]);
    expect(weakRuntime.output).toContain('RETENTION_DISCLOSURE_DATABASE_URL');
  });
});

describe('restore drill smoke (B2 work 6 보강)', () => {
  const drillEnv = {
    RESTORE_DRILL_MIGRATION_DATABASE_URL: PRISMA_FORM_B,
    RESTORE_DRILL_DATABASE_URL: RUNTIME_URLS.DATABASE_URL,
    RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL: RUNTIME_URLS.RETENTION_WORKER_DATABASE_URL,
    RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL: RUNTIME_URLS.RETENTION_DISCLOSURE_DATABASE_URL,
  };

  it('복원 DB의 마지막 migration이 저장소 마지막 migration 디렉터리이고 pgaudit가 있으면 role smoke까지 통과한다', () => {
    expect(LAST_MIGRATION).toBeTruthy();
    const result = run('restore-drill-smoke.sh', drillEnv);

    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(`restore drill last migration verified: ${LAST_MIGRATION}`);
    expect(result.output).toContain('restore drill pgaudit verified');
    expect(result.output).toContain('role grant smoke complete');
  });

  it('마지막 migration 이름이 다르면 role smoke 전에 실패한다', () => {
    const result = run('restore-drill-smoke.sh', {
      ...drillEnv,
      FAKE_LAST_MIGRATION: '20000101000000_older',
    });

    expect(result.status).toBe(65);
    expect(result.output).toContain('restored DB last migration mismatch');
    expect(result.output).not.toContain('role grant smoke complete');
  });

  it('pgaudit extension 또는 preload가 없으면 role smoke 전에 실패한다', () => {
    const result = run('restore-drill-smoke.sh', { ...drillEnv, FAKE_PGAUDIT: 'f' });

    expect(result.status).toBe(65);
    expect(result.output).toContain('restored DB pgaudit is not loaded');
    expect(result.output).not.toContain('role grant smoke complete');
  });
});
