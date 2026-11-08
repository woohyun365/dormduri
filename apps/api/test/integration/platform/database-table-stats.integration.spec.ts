import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DATABASE_MAINTENANCE_TABLES,
  DatabaseTableStatsService,
} from '../../../src/platform/database/database-table-stats.service.js';
import { DOMAIN_METRICS_PORT } from '../../../src/platform/observability/metrics/domain-metrics.port.js';
import type { DomainMetricsPort } from '../../../src/platform/observability/metrics/domain-metrics.port.js';
import { PrometheusRegistryService } from '../../../src/platform/observability/metrics/prometheus-registry.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import { createIntegrationDatabaseSandbox } from '../_support/integration-db.js';
import {
  INTEGRATION_LOGIN_USERS,
  resolveIntegrationDatabaseRoleMode,
} from '../_support/integration-db-roles.js';
import { cleanupIntegrationTestResources } from '../_support/integration-suite.js';

const schemaPath = resolve(process.cwd(), '../../packages/database/prisma/schema.prisma');

describe('DatabaseTableStatsService against PostgreSQL', () => {
  it('lists existing Prisma models and every outbox model', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const outboxModels = [...schema.matchAll(/^model (\w*Outbox\w*) \{/gmu)].map(
      (match) => match[1],
    );

    expect(outboxModels.length).toBeGreaterThan(0);
    expect([...DATABASE_MAINTENANCE_TABLES]).toEqual(expect.arrayContaining(outboxModels));
    for (const table of DATABASE_MAINTENANCE_TABLES) {
      expect(schema, table).toContain(`model ${table} {`);
    }
  });

  it('reads pg_stat_user_tables with the runtime credential and only reports the listed tables', async () => {
    const sandbox = await createIntegrationDatabaseSandbox('database_table_stats');
    const { app } = await createIntegrationApp().catch(async (error: unknown) => {
      await sandbox.cleanup();
      throw error;
    });

    try {
      if (resolveIntegrationDatabaseRoleMode() === 'separated') {
        expect(new URL(process.env.DATABASE_URL ?? '').username).toBe(
          INTEGRATION_LOGIN_USERS.runtime.user,
        );
      }
      const metrics = app.get<DomainMetricsPort>(DOMAIN_METRICS_PORT, { strict: false });
      const setGauge = vi.spyOn(metrics, 'setGauge');

      await app.get(DatabaseTableStatsService, { strict: false }).collectOnce();

      const ratioGauges = setGauge.mock.calls
        .map(([input]) => input)
        .filter((input) => input.name === 'api_db_table_dead_tuple_ratio');
      expect(ratioGauges.map((input) => input.labels?.table).sort()).toEqual(
        [...DATABASE_MAINTENANCE_TABLES].sort(),
      );
      for (const [input] of setGauge.mock.calls) {
        expect(Object.keys(input.labels ?? {})).toEqual(['table']);
      }

      // The Prometheus adapter lowercases label values, so alert rules match the lowercase name.
      const exported = await app
        .get(PrometheusRegistryService, { strict: false })
        .getRegister()
        .metrics();
      expect(exported).toMatch(/api_db_table_dead_tuples\{[^}]*table="archivejob"/u);
    } finally {
      await cleanupIntegrationTestResources({
        closeApp: () => app.close(),
        cleanupDatabase: () => sandbox.cleanup(),
      });
    }
  });
});
