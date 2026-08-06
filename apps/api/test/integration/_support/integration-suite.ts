import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import type { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp, type IntegrationAppContext } from './integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
  type IntegrationDatabaseSandbox,
} from './integration-db.js';

export interface IntegrationTestSuiteOptions {
  /**
   * Defaults to true. Keep disabled only for suites that own their data cleanup
   * inside each test case.
   */
  truncateBeforeEach?: boolean;
}

export interface IntegrationTestSuiteHandle {
  readonly app: INestApplication;
  readonly prisma: PrismaService;
  readonly databaseSandbox: IntegrationDatabaseSandbox;
}

export async function cleanupIntegrationTestResources(input: {
  closeApp?: (() => Promise<void>) | null;
  cleanupDatabase?: (() => Promise<void>) | null;
}): Promise<void> {
  const errors: unknown[] = [];

  try {
    await input.closeApp?.();
  } catch (error) {
    errors.push(error);
  }

  try {
    await input.cleanupDatabase?.();
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, '[integration-suite] app and database cleanup failed');
  }
}

export function useIntegrationTestSuite(
  schemaPrefix: string,
  options: IntegrationTestSuiteOptions = {},
): IntegrationTestSuiteHandle {
  let appContext: IntegrationAppContext | null = null;
  let databaseSandbox: IntegrationDatabaseSandbox | null = null;

  const truncateBeforeEach = options.truncateBeforeEach ?? true;

  function requireAppContext() {
    if (!appContext) {
      throw new Error('[integration-suite] app context is not initialized yet');
    }

    return appContext;
  }

  function requireDatabaseSandbox() {
    if (!databaseSandbox) {
      throw new Error('[integration-suite] database sandbox is not initialized yet');
    }

    return databaseSandbox;
  }

  beforeAll(async () => {
    databaseSandbox = await createIntegrationDatabaseSandbox(schemaPrefix);
    appContext = await createIntegrationApp();
  });

  beforeEach(async () => {
    if (truncateBeforeEach) {
      await truncateIntegrationSchema(requireAppContext().prisma);
    }
  });

  afterAll(async () => {
    const currentAppContext = appContext;
    const currentDatabaseSandbox = databaseSandbox;
    const closeApp = currentAppContext ? () => currentAppContext.app.close() : null;
    const cleanupDatabase = currentDatabaseSandbox ? () => currentDatabaseSandbox.cleanup() : null;
    appContext = null;
    databaseSandbox = null;

    await cleanupIntegrationTestResources({ closeApp, cleanupDatabase });
  });

  return {
    get app() {
      return requireAppContext().app;
    },
    get prisma() {
      return requireAppContext().prisma;
    },
    get databaseSandbox() {
      return requireDatabaseSandbox();
    },
  };
}
