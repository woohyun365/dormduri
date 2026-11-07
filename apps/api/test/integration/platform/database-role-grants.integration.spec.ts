import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@repo/database/client';
import { Client } from 'pg';
import { SeasonOperationsAuditRepository } from '../../../src/seasons/operations/season-operations-audit.repository.js';
import { runPrismaMigrateDeploy } from '../_support/integration-db.js';
import {
  INTEGRATION_ADMIN_DATABASE_URL_ENV,
  INTEGRATION_LOGIN_USERS,
  quoteIdentifier,
  resolveIntegrationDatabaseRoleMode,
  withDatabaseUser,
} from '../_support/integration-db-roles.js';
import {
  applyRoleGrants,
  readRoleGrantFile,
  ROLE_GRANT_FILES,
  smokeRoleGrants,
} from '../../support/database/role-grant-inputs.js';

const LOGIN_USERS_BY_ROLE = {
  app_runtime: INTEGRATION_LOGIN_USERS.runtime.user,
  retention_worker: INTEGRATION_LOGIN_USERS.retentionWorker.user,
  retention_disclosure: INTEGRATION_LOGIN_USERS.retentionDisclosure.user,
};

/**
 * The production order once on a fresh schema (infra/db/README.md, Release order):
 * master bootstrap → dormduri_migrator `migrate deploy` → database defaults and grant
 * table → read-only smoke for every LOGIN user, then real queries as each LOGIN user.
 */
describe.skipIf(resolveIntegrationDatabaseRoleMode() !== 'separated')(
  'DB role grant pipeline integration',
  () => {
    const schemaName = `role_pipeline_${randomUUID().replaceAll('-', '')}`;
    let adminBaseUrl: string;
    let admin: Client;

    function urlFor(login: { user: string; password: string }) {
      const url = new URL(withDatabaseUser(adminBaseUrl, login.user, login.password));
      url.searchParams.set('schema', schemaName);
      return url.toString();
    }

    async function connect(login: { user: string; password: string }) {
      const url = new URL(urlFor(login));
      url.searchParams.delete('schema');
      const client = new Client({
        connectionString: url.toString(),
        options: `-c search_path=${schemaName}`,
      });
      await client.connect();
      return client;
    }

    async function withLogin<T>(
      login: { user: string; password: string },
      work: (client: Client) => Promise<T>,
    ): Promise<T> {
      const client = await connect(login);
      try {
        return await work(client);
      } finally {
        await client.end();
      }
    }

    async function asMigrator<T>(work: (client: Client) => Promise<T>) {
      return withLogin(INTEGRATION_LOGIN_USERS.migrator, work);
    }

    async function applyAsMigrator() {
      await asMigrator(async (client) => {
        await client.query('BEGIN');
        try {
          await client.query(readRoleGrantFile(ROLE_GRANT_FILES.databaseDefaults));
          await applyRoleGrants(client, schemaName);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });
    }

    async function smokeAsMigrator() {
      return asMigrator((client) =>
        smokeRoleGrants(client, {
          schemaName,
          expectedTableOwner: 'migration_owner',
          loginUsers: LOGIN_USERS_BY_ROLE,
        }),
      );
    }

    function table(name: string) {
      return `${quoteIdentifier(schemaName)}.${quoteIdentifier(name)}`;
    }

    beforeAll(async () => {
      adminBaseUrl = process.env[INTEGRATION_ADMIN_DATABASE_URL_ENV] ?? '';
      expect(adminBaseUrl).not.toBe('');
      admin = new Client({ connectionString: adminBaseUrl });
      await admin.connect();
      await admin.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
      // Second bootstrap run in this database (the global setup ran the first): it must
      // keep existing roles and only add the schema privilege for migration_owner.
      await admin.query("SELECT set_config('dormduri.bootstrap_schema', $1, false)", [schemaName]);
      await admin.query("SELECT set_config('dormduri.bootstrap_pgaudit', 'off', false)");
      await admin.query(readRoleGrantFile(ROLE_GRANT_FILES.bootstrap));

      runPrismaMigrateDeploy(urlFor(INTEGRATION_LOGIN_USERS.migrator));
      await applyAsMigrator();
    }, 120_000);

    afterAll(async () => {
      if (admin) {
        await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
        await admin.end();
      }
    });

    it('migrator는 migration_owner로 접속해 schema 객체를 소유하고 smoke가 표 전체를 확인한다', async () => {
      const identity = await asMigrator(async (client) => {
        const { rows } = await client.query<{ current_user: string; session_user: string }>(
          'SELECT current_user, session_user',
        );
        return rows[0];
      });
      expect(identity).toEqual({
        current_user: 'migration_owner',
        session_user: INTEGRATION_LOGIN_USERS.migrator.user,
      });

      const summary = await smokeAsMigrator();
      expect(summary).toMatch(
        /^role grant smoke ok: schema \S+, 3 LOGIN users, \d+ table checks, \d+ column checks$/u,
      );
    });

    it('grant 적용은 다시 실행해도 같은 결과다', async () => {
      await applyAsMigrator();
      await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
    });

    it('runtime LOGIN user는 RRPD payload·migration 기록에 닿지 않고 감사 table은 append만 한다', async () => {
      await withLogin(INTEGRATION_LOGIN_USERS.runtime, async (client) => {
        await expect(
          client.query(`SELECT "id" FROM ${table('User')} LIMIT 1`),
        ).resolves.toBeDefined();
        for (const sql of [
          `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
          `SELECT "encryptedIdentifierPayload" FROM ${table('RetainedIdentity')} LIMIT 1`,
          `SELECT "metadata" FROM ${table('RetentionCase')} LIMIT 1`,
          `SELECT "migration_name" FROM ${table('_prisma_migrations')} LIMIT 1`,
          `UPDATE ${table('SeasonOperationAuditEvent')} SET "reason" = "reason"`,
          `DELETE FROM ${table('SeasonOperationAuditEvent')}`,
          `TRUNCATE ${table('User')}`,
        ]) {
          await expect(client.query(sql), sql).rejects.toThrow(/permission denied/u);
        }
        await expect(
          client.query(`SELECT "id" FROM ${table('RetentionCase')} LIMIT 1`),
        ).resolves.toBeDefined();
      });
    });

    it('runtime LOGIN user가 production repository로 시즌 운영 감사를 append한다', async () => {
      // No API integration runs this write, so the narrowed SELECT·INSERT class is
      // proven here once with the runtime credential.
      const seasonId = `audit-season-${randomUUID()}`;
      await admin.query(
        `INSERT INTO ${table('CampusMaster')} ("code", "nameKo", "isOperated") VALUES ('DOGYE', 'test', true)`,
      );
      const { rows } = await admin.query<Record<string, unknown>>(
        `INSERT INTO ${table('Season')} ("id", "campusCode", "academicYear", "semester", "name", "preparationStartDate", "matchingStartDate", "seasonEndDate")
         VALUES ($1, 'DOGYE', 2026, 2, 'audit', '2026-08-01', '2026-08-15', '2026-12-31')
         RETURNING "id", "campusCode", "name", "preparationStartDate", "matchingStartDate", "seasonEndDate", "updatedAt", "overrideState", "overrideReason", "overrideStartedAt", "overrideEndsAt"`,
        [seasonId],
      );
      const season = rows[0] as never;
      const runtimeUrl = new URL(urlFor(INTEGRATION_LOGIN_USERS.runtime));
      runtimeUrl.searchParams.delete('schema');
      const runtime = new PrismaClient({
        adapter: new PrismaPg(
          {
            connectionString: runtimeUrl.toString(),
            max: 1,
            options: `-c search_path=${schemaName}`,
          },
          { schema: schemaName },
        ),
      });
      try {
        const appended = await new SeasonOperationsAuditRepository().append({
          client: runtime,
          action: 'UPDATE_SCHEDULE',
          actor: { id: 'operator-1', capabilities: [] } as never,
          seasonId,
          reason: 'role pipeline append',
          previousSeason: season,
          nextSeason: season,
        });
        const stored = await admin.query(
          `SELECT "action" FROM ${table('SeasonOperationAuditEvent')} WHERE "id" = $1`,
          [appended.id],
        );
        expect(stored.rows).toEqual([{ action: 'UPDATE_SCHEDULE' }]);
        await expect(
          runtime.seasonOperationAuditEvent.update({
            where: { id: appended.id },
            data: { reason: 'rewritten' },
          }),
        ).rejects.toThrow(/permission denied|denied access/iu);
      } finally {
        await runtime.$disconnect();
        await admin.query(`DELETE FROM ${table('Season')} WHERE "id" = $1`, [seasonId]);
        await admin.query(`DELETE FROM ${table('CampusMaster')} WHERE "code" = 'DOGYE'`);
      }
    });

    it('worker·disclosure LOGIN user는 RRPD 경계를 각자 credential로 가진다', async () => {
      await withLogin(INTEGRATION_LOGIN_USERS.retentionWorker, async (client) => {
        await expect(
          client.query(`SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`),
        ).resolves.toBeDefined();
        await expect(
          client.query(`SELECT "payload" FROM ${table('ChatRealtimeOutboxEvent')} LIMIT 1`),
        ).rejects.toThrow(/permission denied/u);
        await expect(
          client.query(`SELECT 1 FROM ${table('SupportTicket')} LIMIT 1`),
        ).rejects.toThrow(/permission denied/u);
      });
      await withLogin(INTEGRATION_LOGIN_USERS.retentionDisclosure, async (client) => {
        await expect(
          client.query(`SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`),
        ).resolves.toBeDefined();
        await expect(
          client.query(`UPDATE ${table('User')} SET "updatedAt" = "updatedAt"`),
        ).rejects.toThrow(/permission denied/u);
        await expect(client.query(`SELECT 1 FROM ${table('ArchiveJob')} LIMIT 1`)).rejects.toThrow(
          /permission denied/u,
        );
      });
    });

    it('사람 조회 role은 secret·content 열을 읽지 못하고 RRPD table을 읽지 못한다', async () => {
      await admin.query('SET ROLE app_readonly');
      try {
        await expect(
          admin.query(`SELECT "id", "email" FROM ${table('User')} LIMIT 1`),
        ).resolves.toBeDefined();
        for (const sql of [
          `SELECT "passwordHash" FROM ${table('User')} LIMIT 1`,
          `SELECT "body" FROM ${table('ConversationMessage')} LIMIT 1`,
          `SELECT * FROM ${table('User')} LIMIT 1`,
          `SELECT 1 FROM ${table('RetainedIdentity')} LIMIT 1`,
          `UPDATE ${table('User')} SET "updatedAt" = "updatedAt"`,
        ]) {
          await expect(admin.query(sql), sql).rejects.toThrow(/permission denied/u);
        }
        await expect(
          admin.query(`SELECT "migration_name" FROM ${table('_prisma_migrations')} LIMIT 1`),
        ).resolves.toBeDefined();
      } finally {
        await admin.query('RESET ROLE');
      }
    });

    it('표 밖 권한이 생기면 smoke가 실패한다', async () => {
      await admin.query(`GRANT UPDATE ON ${table('SeasonOperationAuditEvent')} TO app_runtime`);
      try {
        await expect(smokeAsMigrator()).rejects.toThrow(
          /app_runtime UPDATE on SeasonOperationAuditEvent: expected denied, actual granted/u,
        );
      } finally {
        await admin.query(
          `REVOKE UPDATE ON ${table('SeasonOperationAuditEvent')} FROM app_runtime`,
        );
      }
      await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
    });

    it('표에 없는 table이나 분류되지 않은 열이 있으면 grant 적용이 실패한다', async () => {
      await asMigrator((client) =>
        client.query(`CREATE TABLE ${table('UnlistedTable')} ("id" text PRIMARY KEY)`),
      );
      try {
        await expect(applyAsMigrator()).rejects.toThrow(
          /relation UnlistedTable is not in role-grant-matrix\.csv/u,
        );
      } finally {
        await asMigrator((client) => client.query(`DROP TABLE ${table('UnlistedTable')}`));
      }

      await asMigrator((client) =>
        client.query(`ALTER TABLE ${table('User')} ADD COLUMN "unclassifiedNote" text`),
      );
      try {
        await expect(applyAsMigrator()).rejects.toThrow(
          /column User\.unclassifiedNote is not in column-classes\.csv/u,
        );
      } finally {
        await asMigrator((client) =>
          client.query(`ALTER TABLE ${table('User')} DROP COLUMN "unclassifiedNote"`),
        );
      }
      await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
    });

    it('표 밖 sequence나 routine이 있으면 grant 적용이 실패한다', async () => {
      for (const [create, drop, message] of [
        [
          `CREATE SEQUENCE ${table('PipelineSeq')}`,
          `DROP SEQUENCE ${table('PipelineSeq')}`,
          /sequence PipelineSeq needs a grant rule/u,
        ],
        [
          `CREATE FUNCTION ${quoteIdentifier(schemaName)}.pipeline_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
          `DROP FUNCTION ${quoteIdentifier(schemaName)}.pipeline_fn()`,
          /routine pipeline_fn needs a grant rule/u,
        ],
      ] as const) {
        await asMigrator((client) => client.query(create));
        try {
          await expect(applyAsMigrator()).rejects.toThrow(message);
        } finally {
          await asMigrator((client) => client.query(drop));
        }
      }
      await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
    });

    it('MAINTAIN·자동 부여 default privilege·사람 user의 추가 membership·직접 grant를 smoke가 거부한다', async () => {
      const human = `dormduri_ro_pipeline_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
      const cases: readonly (readonly [string, string, RegExp])[] = [
        [
          `GRANT MAINTAIN ON ${table('User')} TO app_runtime`,
          `REVOKE MAINTAIN ON ${table('User')} FROM app_runtime`,
          /app_runtime MAINTAIN on User: expected denied, actual granted/u,
        ],
        [
          `ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner IN SCHEMA ${quoteIdentifier(schemaName)} GRANT SELECT ON TABLES TO app_readonly`,
          `ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner IN SCHEMA ${quoteIdentifier(schemaName)} REVOKE SELECT ON TABLES FROM app_readonly`,
          /migration_owner default privileges grant SELECT on new tables to app_readonly/u,
        ],
        [
          `GRANT retention_disclosure TO ${quoteIdentifier(human)}`,
          `REVOKE retention_disclosure FROM ${quoteIdentifier(human)}`,
          new RegExp(`LOGIN user ${human} is a member of app_readonly, retention_disclosure`, 'u'),
        ],
        [
          `GRANT SELECT ON ${table('User')} TO ${quoteIdentifier(human)}`,
          `REVOKE SELECT ON ${table('User')} FROM ${quoteIdentifier(human)}`,
          new RegExp(`${human} has a direct grant on User`, 'u'),
        ],
      ];
      // A human read-only user as bootstrap makes it: LOGIN and a member of app_readonly only.
      await admin.query(`CREATE ROLE ${quoteIdentifier(human)} LOGIN`);
      await admin.query(`GRANT app_readonly TO ${quoteIdentifier(human)}`);
      try {
        await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
        for (const [tamper, restore, message] of cases) {
          await admin.query(tamper);
          try {
            await expect(smokeAsMigrator()).rejects.toThrow(message);
          } finally {
            await admin.query(restore);
          }
        }
      } finally {
        await admin.query(`DROP ROLE ${quoteIdentifier(human)}`);
      }
      await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
    });
  },
);
