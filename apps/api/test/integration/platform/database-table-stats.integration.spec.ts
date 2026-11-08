import { describe, expect, it, vi } from 'vitest';
import {
  DATABASE_MAINTENANCE_TABLES,
  DatabaseTableStatsService,
} from '../../../src/platform/database/database-table-stats.service.js';
import { DOMAIN_METRICS_PORT } from '../../../src/platform/observability/metrics/domain-metrics.port.js';
import type { DomainMetricsPort } from '../../../src/platform/observability/metrics/domain-metrics.port.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import { createIntegrationDatabaseSandbox } from '../_support/integration-db.js';
import {
  INTEGRATION_LOGIN_USERS,
  resolveIntegrationDatabaseRoleMode,
} from '../_support/integration-db-roles.js';
import { cleanupIntegrationTestResources } from '../_support/integration-suite.js';

describe('DatabaseTableStatsService against PostgreSQL', () => {
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
    } finally {
      await cleanupIntegrationTestResources({
        closeApp: () => app.close(),
        cleanupDatabase: () => sandbox.cleanup(),
      });
    }
  });
});
