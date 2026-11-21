import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  backoffice_runtime: INTEGRATION_LOGIN_USERS.backoffice.user,
  backoffice_retention: INTEGRATION_LOGIN_USERS.backofficeRetention.user,
};

const ADMIN_TABLES = [
  'AdminAccount',
  'AdminPasswordCredential',
  'AdminPasskeyCredential',
  'AdminTotpCredential',
  'AdminRecoveryCode',
  'AdminInvitation',
  'AdminSession',
  'AdminWebAuthnChallenge',
  'AdminRoleAssignment',
  'AdminApprovalRequest',
  'AdminAuditEvent',
];

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
        /^role grant smoke ok: schema \S+, \d+ LOGIN users, \d+ table checks, \d+ column checks$/u,
      );
      // The five service LOGIN users at least; other LOGIN members of one group join the count.
      expect(smokeLoginCount(summary)).toBeGreaterThanOrEqual(5);
    });

    it('grant 적용은 다시 실행해도 같은 결과다', async () => {
      await applyAsMigrator();
      await expect(smokeAsMigrator()).resolves.toContain('role grant smoke ok');
    });

    it('runtime LOGIN user는 RRPD payload·migration 기록(readiness가 세는 두 열 밖)에 닿지 않고 감사 table은 append만 한다', async () => {
      await withLogin(INTEGRATION_LOGIN_USERS.runtime, async (client) => {
        await expect(
          client.query(`SELECT "id" FROM ${table('User')} LIMIT 1`),
        ).resolves.toBeDefined();
        // /health/ready runs this query on the runtime connection.
        const readiness = readFileSync(
          resolve(process.cwd(), '../../packages/database/prisma/sql/getDatabaseReadiness.sql'),
          'utf8',
        ).replace('"_prisma_migrations"', table('_prisma_migrations'));
        await expect(client.query(readiness)).resolves.toMatchObject({
          rows: [{ failedCount: 0, incompleteCount: 0 }],
        });
        for (const sql of [
          `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
          `SELECT "encryptedIdentifierPayload" FROM ${table('RetainedIdentity')} LIMIT 1`,
          `SELECT "metadata" FROM ${table('RetentionCase')} LIMIT 1`,
          `SELECT "migration_name" FROM ${table('_prisma_migrations')} LIMIT 1`,
          `SELECT "logs" FROM ${table('_prisma_migrations')} LIMIT 1`,
          `SELECT "checksum" FROM ${table('_prisma_migrations')} LIMIT 1`,
          `SELECT * FROM ${table('_prisma_migrations')} LIMIT 1`,
          `UPDATE ${table('_prisma_migrations')} SET "finished_at" = "finished_at"`,
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
        // The audit FK is Restrict (#868), so the fixture removes the audit row before its season.
        await admin.query(
          `DELETE FROM ${table('SeasonOperationAuditEvent')} WHERE "seasonId" = $1`,
          [seasonId],
        );
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

    it('사용자 API LOGIN user 셋은 관리자 table에 닿지 않는다', async () => {
      for (const login of [
        INTEGRATION_LOGIN_USERS.runtime,
        INTEGRATION_LOGIN_USERS.retentionWorker,
        INTEGRATION_LOGIN_USERS.retentionDisclosure,
      ]) {
        await withLogin(login, async (client) => {
          for (const name of ADMIN_TABLES) {
            await expect(
              client.query(`SELECT 1 FROM ${table(name)} LIMIT 1`),
              `${login.user} ${name}`,
            ).rejects.toThrow(/permission denied/u);
          }
          await expect(
            client.query(`DELETE FROM ${table('AdminAuditEvent')}`),
            login.user,
          ).rejects.toThrow(/permission denied/u);
        });
      }
    });

    it('backoffice LOGIN user는 관리자 table만 쓰고 감사는 append만 한다', async () => {
      const accountId = randomUUID();
      const auditId = randomUUID();
      try {
        await withLogin(INTEGRATION_LOGIN_USERS.backoffice, async (client) => {
          await client.query(
            `INSERT INTO ${table('AdminAccount')} ("id", "email", "displayName") VALUES ($1, $2, 'operator')`,
            [accountId, `${accountId}@backoffice.invalid`],
          );
          await client.query(
            `INSERT INTO ${table('AdminPasswordCredential')} ("accountId", "passwordHash") VALUES ($1, 'argon2id-hash')`,
            [accountId],
          );
          await client.query(
            `INSERT INTO ${table('AdminAuditEvent')} ("id", "actorType", "actorAccountId", "action", "result") VALUES ($1, 'ADMIN', $2, 'LOGIN', 'SUCCEEDED')`,
            [auditId, accountId],
          );
          // Deactivation: status change and immediate credential removal (operator-access.md OA-R6).
          await client.query(
            `UPDATE ${table('AdminAccount')} SET "status" = 'DEACTIVATED', "deactivatedAt" = now(), "updatedAt" = now() WHERE "id" = $1`,
            [accountId],
          );
          await expect(
            client.query(`DELETE FROM ${table('AdminPasswordCredential')} WHERE "accountId" = $1`, [
              accountId,
            ]),
          ).resolves.toMatchObject({ rowCount: 1 });
          for (const sql of [
            // The audit time is the database clock only: occurredAt has no INSERT privilege.
            `INSERT INTO ${table('AdminAuditEvent')} ("id", "occurredAt", "actorType", "actorAccountId", "action", "result") VALUES ('${randomUUID()}', now() - interval '4 years', 'ADMIN', '${accountId}', 'LOGIN', 'SUCCEEDED')`,
            `UPDATE ${table('AdminAuditEvent')} SET "reason" = "reason"`,
            `DELETE FROM ${table('AdminAuditEvent')}`,
            `UPDATE ${table('AdminAccount')} SET "email" = "email"`,
            `UPDATE ${table('AdminAccount')} SET "anonymizedAt" = now()`,
            `DELETE FROM ${table('AdminSession')}`,
            `DELETE FROM ${table('AdminRoleAssignment')}`,
            `SELECT 1 FROM ${table('User')} LIMIT 1`,
            `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
            `SELECT 1 FROM ${table('SeasonOperationAuditEvent')} LIMIT 1`,
          ]) {
            await expect(client.query(sql), sql).rejects.toThrow(/permission denied/u);
          }
        });
      } finally {
        await admin.query(`DELETE FROM ${table('AdminAuditEvent')} WHERE "id" = $1`, [auditId]);
        await admin.query(
          `DELETE FROM ${table('AdminPasswordCredential')} WHERE "accountId" = $1`,
          [accountId],
        );
        await admin.query(`DELETE FROM ${table('AdminAccount')} WHERE "id" = $1`, [accountId]);
      }
    });

    it('backoffice_retention LOGIN user는 정리 조건 열을 읽고 폐기·익명화·정리만 한다', async () => {
      const accountId = randomUUID();
      const oldAuditId = randomUUID();
      const sessionId = randomUUID();
      await admin.query(
        `INSERT INTO ${table('AdminAccount')} ("id", "email", "displayName", "status", "deactivatedAt") VALUES ($1, $2, 'former operator', 'DEACTIVATED', now() - interval '4 years')`,
        [accountId, `${accountId}@backoffice.invalid`],
      );
      await admin.query(
        `INSERT INTO ${table('AdminAuditEvent')} ("id", "occurredAt", "actorType", "actorAccountId", "action", "result") VALUES ($1, now() - interval '3 years 1 day', 'ADMIN', $2, 'LOGOUT', 'SUCCEEDED')`,
        [oldAuditId, accountId],
      );
      await admin.query(
        `INSERT INTO ${table('AdminSession')} ("id", "accountId", "tokenHash", "scope", "lastActivityAt", "absoluteExpiresAt", "revokedAt", "revocationReason") VALUES ($1, $2, $3, 'FULL', now() - interval '8 days', now() - interval '8 days', now() - interval '8 days', 'LOGOUT')`,
        [sessionId, accountId, `token-hash-${sessionId}`],
      );
      try {
        await withLogin(INTEGRATION_LOGIN_USERS.backofficeRetention, async (client) => {
          await expect(
            client.query(
              `DELETE FROM ${table('AdminAuditEvent')} WHERE "id" = $1 AND "occurredAt" < now() - interval '3 years'`,
              [oldAuditId],
            ),
          ).resolves.toMatchObject({ rowCount: 1 });
          await expect(
            client.query(
              `UPDATE ${table('AdminAccount')} SET "email" = $2, "displayName" = 'anonymized', "anonymizedAt" = now(), "updatedAt" = now()
               WHERE "id" = $1 AND "status" = 'DEACTIVATED' AND "anonymizedAt" IS NULL`,
              [accountId, `anonymized-${accountId}@backoffice.invalid`],
            ),
          ).resolves.toMatchObject({ rowCount: 1 });
          await expect(
            client.query(
              `DELETE FROM ${table('AdminSession')} WHERE "id" = $1 AND "revokedAt" < now() - interval '7 days'`,
              [sessionId],
            ),
          ).resolves.toMatchObject({ rowCount: 1 });
          for (const sql of [
            `INSERT INTO ${table('AdminAuditEvent')} ("id", "actorType", "action", "result") VALUES ('${randomUUID()}', 'SYSTEM', 'LOGIN', 'SUCCEEDED')`,
            `UPDATE ${table('AdminAuditEvent')} SET "occurredAt" = "occurredAt"`,
            `SELECT "reason" FROM ${table('AdminAuditEvent')} LIMIT 1`,
            `SELECT * FROM ${table('AdminAccount')} LIMIT 1`,
            `UPDATE ${table('AdminAccount')} SET "status" = 'ACTIVE'`,
            `DELETE FROM ${table('AdminAccount')}`,
            `DELETE FROM ${table('AdminPasswordCredential')}`,
            `SELECT "tokenHash" FROM ${table('AdminSession')} LIMIT 1`,
            `SELECT 1 FROM ${table('User')} LIMIT 1`,
            `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
          ]) {
            await expect(client.query(sql), sql).rejects.toThrow(/permission denied/u);
          }
        });
        const { rows } = await admin.query<{ email: string; anonymizedAt: Date | null }>(
          `SELECT "email", "anonymizedAt" FROM ${table('AdminAccount')} WHERE "id" = $1`,
          [accountId],
        );
        expect(rows[0]?.email).toBe(`anonymized-${accountId}@backoffice.invalid`);
        expect(rows[0]?.anonymizedAt).not.toBeNull();
      } finally {
        await admin.query(`DELETE FROM ${table('AdminSession')} WHERE "id" = $1`, [sessionId]);
        await admin.query(`DELETE FROM ${table('AdminAuditEvent')} WHERE "id" = $1`, [oldAuditId]);
        await admin.query(`DELETE FROM ${table('AdminAccount')} WHERE "id" = $1`, [accountId]);
      }
    });

    it('감사 행이 가리키는 시즌·관리자 계정·승인 요청은 지워지지도 id가 바뀌지도 않는다(#868, db.integrity.audit-tables)', async () => {
      const seasonId = `audit-fk-season-${randomUUID()}`;
      const seasonAuditId = `audit-fk-${randomUUID()}`;
      const accountId = randomUUID();
      const requestId = randomUUID();
      const adminAuditId = randomUUID();
      // Pointed to only by its own audit row, so the audit actor FK alone decides the delete.
      const auditOnlyAccountId = randomUUID();
      const auditOnlyAuditId = randomUUID();
      await admin.query(
        `INSERT INTO ${table('CampusMaster')} ("code", "nameKo", "isOperated") VALUES ('SAMCHEOK', 'test', true)`,
      );
      await admin.query(
        `INSERT INTO ${table('Season')} ("id", "campusCode", "academicYear", "semester", "name", "preparationStartDate", "matchingStartDate", "seasonEndDate")
         VALUES ($1, 'SAMCHEOK', 2026, 2, 'audit fk', '2026-08-01', '2026-08-15', '2026-12-31')`,
        [seasonId],
      );
      await admin.query(
        `INSERT INTO ${table('SeasonOperationAuditEvent')} ("id", "seasonId", "campusCode", "action", "previousSnapshot", "nextSnapshot")
         VALUES ($1, $2, 'SAMCHEOK', 'UPDATE_SCHEDULE', '{}', '{}')`,
        [seasonAuditId, seasonId],
      );
      await admin.query(
        `INSERT INTO ${table('AdminAccount')} ("id", "email", "displayName") VALUES ($1, $2, 'owner')`,
        [accountId, `${accountId}@backoffice.invalid`],
      );
      await admin.query(
        `INSERT INTO ${table('AdminApprovalRequest')} ("id", "kind", "contentDigest", "targetAccountId", "targetRole", "requestedByAccountId", "expiresAt")
         VALUES ($1, 'ROLE_GRANT', 'digest', $2, 'AUDITOR', $2, now() + interval '1 day')`,
        [requestId, accountId],
      );
      await admin.query(
        `INSERT INTO ${table('AdminAuditEvent')} ("id", "actorType", "actorAccountId", "action", "approvalRequestId", "result")
         VALUES ($1, 'ADMIN', $2, 'ACCESS_REQUEST_CREATE', $3, 'SUCCEEDED')`,
        [adminAuditId, accountId, requestId],
      );
      await admin.query(
        `INSERT INTO ${table('AdminAccount')} ("id", "email", "displayName") VALUES ($1, $2, 'operator')`,
        [auditOnlyAccountId, `${auditOnlyAccountId}@backoffice.invalid`],
      );
      await admin.query(
        `INSERT INTO ${table('AdminAuditEvent')} ("id", "actorType", "actorAccountId", "action", "result")
         VALUES ($1, 'ADMIN', $2, 'LOGIN', 'SUCCEEDED')`,
        [auditOnlyAuditId, auditOnlyAccountId],
      );
      // PostgreSQL names the rule and the constraint: each case must fail on its audit FK.
      const restrictedBy = (constraint: string) =>
        new RegExp(`violates RESTRICT setting of foreign key constraint "${constraint}"`, 'u');
      try {
        // The user API runtime holds DELETE and UPDATE on Season.
        await withLogin(INTEGRATION_LOGIN_USERS.runtime, async (client) => {
          await expect(
            client.query(`DELETE FROM ${table('Season')} WHERE "id" = $1`, [seasonId]),
          ).rejects.toThrow(restrictedBy('SeasonOperationAuditEvent_seasonId_fkey'));
          await expect(
            client.query(`UPDATE ${table('Season')} SET "id" = $2 WHERE "id" = $1`, [
              seasonId,
              `${seasonId}-renamed`,
            ]),
          ).rejects.toThrow(restrictedBy('SeasonOperationAuditEvent_seasonId_fkey'));
        });
        // The cleanup job holds DELETE on approval requests; an audit row still points here.
        await withLogin(INTEGRATION_LOGIN_USERS.backofficeRetention, async (client) => {
          await expect(
            client.query(`DELETE FROM ${table('AdminApprovalRequest')} WHERE "id" = $1`, [
              requestId,
            ]),
          ).rejects.toThrow(restrictedBy('AdminAuditEvent_approvalRequestId_fkey'));
        });
        // No role deletes accounts, so the owner connection shows the FK rule itself.
        await expect(
          admin.query(`DELETE FROM ${table('AdminAccount')} WHERE "id" = $1`, [auditOnlyAccountId]),
        ).rejects.toThrow(restrictedBy('AdminAuditEvent_actorAccountId_fkey'));
        await expect(
          admin.query(`UPDATE ${table('AdminAccount')} SET "id" = $2 WHERE "id" = $1`, [
            auditOnlyAccountId,
            randomUUID(),
          ]),
        ).rejects.toThrow(restrictedBy('AdminAuditEvent_actorAccountId_fkey'));
        const remaining = await admin.query<{ id: string; seasonId: string }>(
          `SELECT "id", "seasonId" FROM ${table('SeasonOperationAuditEvent')} WHERE "id" = $1`,
          [seasonAuditId],
        );
        expect(remaining.rows).toEqual([{ id: seasonAuditId, seasonId }]);
      } finally {
        await admin.query(`DELETE FROM ${table('AdminAuditEvent')} WHERE "id" IN ($1, $2)`, [
          adminAuditId,
          auditOnlyAuditId,
        ]);
        await admin.query(`DELETE FROM ${table('AdminApprovalRequest')} WHERE "id" = $1`, [
          requestId,
        ]);
        await admin.query(`DELETE FROM ${table('AdminAccount')} WHERE "id" IN ($1, $2)`, [
          accountId,
          auditOnlyAccountId,
        ]);
        await admin.query(`DELETE FROM ${table('SeasonOperationAuditEvent')} WHERE "id" = $1`, [
          seasonAuditId,
        ]);
        await admin.query(`DELETE FROM ${table('Season')} WHERE "id" = $1`, [seasonId]);
        await admin.query(`DELETE FROM ${table('CampusMaster')} WHERE "code" = 'SAMCHEOK'`);
      }
    });

    it('관리자 table은 같은 계정·역할의 활성 부여를 하나로 두고 정리 조건의 상태·시각 짝을 DB가 막는다', async () => {
      const accountId = randomUUID();
      const requestId = randomUUID();
      const firstAssignmentId = randomUUID();
      const secondAssignmentId = randomUUID();
      const nextAssignmentId = randomUUID();
      const uniqueBy = (name: string) =>
        new RegExp(`duplicate key value violates unique constraint "${name}"`, 'u');
      const checkedBy = (name: string) => new RegExp(`violates check constraint "${name}"`, 'u');
      try {
        await withLogin(INTEGRATION_LOGIN_USERS.backoffice, async (client) => {
          await client.query(
            `INSERT INTO ${table('AdminAccount')} ("id", "email", "displayName") VALUES ($1, $2, 'operator')`,
            [accountId, `${accountId}@backoffice.invalid`],
          );
          await client.query(
            `INSERT INTO ${table('AdminRoleAssignment')} ("id", "accountId", "role") VALUES ($1, $2, 'AUDITOR')`,
            [firstAssignmentId, accountId],
          );
          await expect(
            client.query(
              `INSERT INTO ${table('AdminRoleAssignment')} ("id", "accountId", "role") VALUES ($1, $2, 'AUDITOR')`,
              [secondAssignmentId, accountId],
            ),
          ).rejects.toThrow(uniqueBy('AdminRoleAssignment_accountId_role_active_key'));
          // A revoked assignment leaves room for a new grant of the same role.
          await client.query(
            `UPDATE ${table('AdminRoleAssignment')} SET "revokedAt" = now() WHERE "id" = $1`,
            [firstAssignmentId],
          );
          await expect(
            client.query(
              `INSERT INTO ${table('AdminRoleAssignment')} ("id", "accountId", "role") VALUES ($1, $2, 'AUDITOR')`,
              [nextAssignmentId, accountId],
            ),
          ).resolves.toMatchObject({ rowCount: 1 });

          await client.query(
            `INSERT INTO ${table('AdminApprovalRequest')} ("id", "kind", "contentDigest", "targetAccountId", "targetRole", "requestedByAccountId", "expiresAt")
             VALUES ($1, 'ROLE_GRANT', 'digest', $2, 'OWNER', $2, now() + interval '1 day')`,
            [requestId, accountId],
          );
          for (const [sql, params, constraint] of [
            [
              `INSERT INTO ${table('AdminApprovalRequest')} ("id", "kind", "contentDigest", "requestedByAccountId", "expiresAt") VALUES ($1, 'ROLE_REVOKE', 'digest', $2, now() + interval '1 day')`,
              [randomUUID(), accountId],
              'AdminApprovalRequest_role_target_check',
            ],
            [
              `UPDATE ${table('AdminApprovalRequest')} SET "status" = 'APPROVED', "decidedByAccountId" = $2 WHERE "id" = $1`,
              [requestId, accountId],
              'AdminApprovalRequest_closed_check',
            ],
            [
              `UPDATE ${table('AdminAccount')} SET "status" = 'DEACTIVATED', "updatedAt" = now() WHERE "id" = $1`,
              [accountId],
              'AdminAccount_deactivated_check',
            ],
            [
              `INSERT INTO ${table('AdminSession')} ("id", "accountId", "tokenHash", "scope", "lastActivityAt", "absoluteExpiresAt", "revokedAt") VALUES ($1, $2, $3, 'FULL', now(), now() + interval '8 hours', now())`,
              [randomUUID(), accountId, `token-hash-${randomUUID()}`],
              'AdminSession_revocation_pair_check',
            ],
            [
              `INSERT INTO ${table('AdminAuditEvent')} ("id", "actorType", "action", "result") VALUES ($1, 'ADMIN', 'LOGIN', 'SUCCEEDED')`,
              [randomUUID()],
              'AdminAuditEvent_actor_check',
            ],
          ] as const) {
            await expect(client.query(sql, [...params]), constraint).rejects.toThrow(
              checkedBy(constraint),
            );
          }
        });
        // Only the cleanup job anonymizes, and only a deactivated account.
        await withLogin(INTEGRATION_LOGIN_USERS.backofficeRetention, async (client) => {
          await expect(
            client.query(
              `UPDATE ${table('AdminAccount')} SET "anonymizedAt" = now(), "updatedAt" = now() WHERE "id" = $1`,
              [accountId],
            ),
          ).rejects.toThrow(checkedBy('AdminAccount_anonymized_check'));
        });
      } finally {
        await admin.query(
          `DELETE FROM ${table('AdminApprovalRequest')} WHERE "requestedByAccountId" = $1`,
          [accountId],
        );
        await admin.query(`DELETE FROM ${table('AdminRoleAssignment')} WHERE "accountId" = $1`, [
          accountId,
        ]);
        await admin.query(`DELETE FROM ${table('AdminAccount')} WHERE "id" = $1`, [accountId]);
      }
    });

    it('사람 조회 role은 secret·content 열과 RRPD를 읽지 못하고 RetentionCase는 행 수만 센다', async () => {
      await admin.query('SET ROLE app_readonly');
      try {
        await expect(
          admin.query(`SELECT "id", "email" FROM ${table('User')} LIMIT 1`),
        ).resolves.toBeDefined();
        // Restore drill baseline: the anchor count without reason, source or hold columns.
        await expect(
          admin.query(`SELECT count(*) FROM ${table('RetentionCase')}`),
        ).resolves.toBeDefined();
        for (const sql of [
          `SELECT "reason" FROM ${table('RetentionCase')} LIMIT 1`,
          `SELECT * FROM ${table('RetentionCase')} LIMIT 1`,
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

    it('MAINTAIN·자동 부여 default privilege·사람 user의 추가 membership·직접 grant·간접 권한을 smoke가 거부한다', async () => {
      const human = `dormduri_ro_pipeline_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
      const outside = `dormduri_pipeline_outside_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
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
          `GRANT SELECT ("id") ON ${table('User')} TO ${quoteIdentifier(human)}`,
          `REVOKE SELECT ("id") ON ${table('User')} FROM ${quoteIdentifier(human)}`,
          new RegExp(`${human} has a direct column grant on User\\.id`, 'u'),
        ],
        // Privileges without an ACL entry or a second direct membership: a predefined role
        // and a group inherited through a role outside the grant table.
        [
          `GRANT pg_read_all_data TO ${quoteIdentifier(human)}`,
          `REVOKE pg_read_all_data FROM ${quoteIdentifier(human)}`,
          new RegExp(`${human} SELECT on \\w+: expected denied, actual granted`, 'u'),
        ],
        [
          `CREATE ROLE ${quoteIdentifier(outside)} NOLOGIN; GRANT retention_disclosure TO ${quoteIdentifier(outside)}; GRANT ${quoteIdentifier(outside)} TO ${quoteIdentifier(human)}`,
          `DROP ROLE ${quoteIdentifier(outside)}`,
          new RegExp(`LOGIN user ${human} is also a member of retention_disclosure`, 'u'),
        ],
      ];
      // A human read-only user as bootstrap makes it: LOGIN and a member of app_readonly only.
      const before = smokeLoginCount(await smokeAsMigrator());
      await admin.query(`CREATE ROLE ${quoteIdentifier(human)} LOGIN`);
      await admin.query(`GRANT app_readonly TO ${quoteIdentifier(human)}`);
      try {
        // The human user is compared with the grant table without a URL of its own.
        expect(smokeLoginCount(await smokeAsMigrator())).toBe(before + 1);
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

function smokeLoginCount(summary: string): number {
  const match = /, (\d+) LOGIN users,/u.exec(summary);
  if (!match?.[1]) {
    throw new Error(`smoke summary without a LOGIN user count: ${summary}`);
  }
  return Number(match[1]);
}
