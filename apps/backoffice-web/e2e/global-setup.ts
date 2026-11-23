import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createE2eDatabase } from './support/database';

/**
 * Starts the real backoffice API (its production build) on a disposable schema and issues the first
 * owner's bootstrap code, the way the Owner will on the host (OA-R10). The Next server itself is
 * Playwright's webServer. Returns the teardown that stops the API by its PID and drops the schema.
 */
const API_DIR = path.resolve(__dirname, '../../backoffice-api');
export const E2E_API_PORT = Number(process.env.BACKOFFICE_E2E_API_PORT ?? 4311);
export const OWNER = { email: 'owner@backoffice.test', displayName: 'Owner' } as const;

async function waitForReady(api: ChildProcess, deadline = Date.now() + 30_000): Promise<void> {
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`backoffice API exited with ${api.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${E2E_API_PORT}/health/ready`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('backoffice API did not become ready');
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const database = await createE2eDatabase();
  const apiEnv = {
    ...process.env,
    NODE_ENV: 'production',
    BACKOFFICE_API_PORT: String(E2E_API_PORT),
    BACKOFFICE_DATABASE_URL: database.runtimeUrl,
    BACKOFFICE_RETENTION_DATABASE_URL: database.retentionUrl,
    BACKOFFICE_TOTP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    BACKOFFICE_METRICS_BEARER_TOKEN: randomBytes(24).toString('base64url'),
    BACKOFFICE_RETENTION_JOB_ENABLED: 'false',
    BACKOFFICE_LOG_LEVEL: 'warn',
  };
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: API_DIR,
    env: apiEnv,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  try {
    await waitForReady(api);
    const issued = execFileSync(
      process.execPath,
      ['dist/cli/bootstrap-owner.js', '--email', OWNER.email, '--display-name', OWNER.displayName],
      {
        cwd: API_DIR,
        env: { ...process.env, BACKOFFICE_DATABASE_URL: database.runtimeUrl },
        encoding: 'utf8',
      },
    );
    const { code } = JSON.parse(issued.trim().split('\n').at(-1)!) as { code: string };
    // Workers inherit this process's env; the code works once within 15 minutes.
    process.env.BACKOFFICE_E2E_BOOTSTRAP_CODE = code;
  } catch (error) {
    api.kill('SIGTERM');
    await database.drop();
    throw error;
  }
  return async () => {
    if (api.exitCode === null) {
      api.kill('SIGTERM');
      await new Promise((resolve) => api.once('exit', resolve));
    }
    await database.drop();
  };
}
