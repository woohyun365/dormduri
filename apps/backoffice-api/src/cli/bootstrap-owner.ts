import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  BootstrapRefusedError,
  issueBootstrapOwnerInvitation,
} from '../admin-identity/bootstrap/bootstrap-owner.js';
import { AdminAuditWriter } from '../audit/admin-audit-writer.js';
import { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { BackofficeMetrics } from '../platform/observability/backoffice-metrics.js';
import { SystemClock } from '../platform/time/clock.js';

/**
 * One-off `bootstrap-owner` (operator-access.md OA-R10), run by the Owner through SSM Run Command:
 *   node dist/cli/bootstrap-owner.js --email <owner email> --display-name <name>
 * It needs only BACKOFFICE_DATABASE_URL. The code is printed once; it works once within 15 minutes
 * and is stored only as a hash. With an active account the command refuses and exits 2.
 */
const inputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  displayName: z.string().trim().min(1).max(80),
});

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, 'display-name': { type: 'string' } },
    strict: true,
  });
  const input = inputSchema.safeParse({ email: values.email, displayName: values['display-name'] });
  const url = process.env.BACKOFFICE_DATABASE_URL;
  if (!input.success || !url) {
    process.stderr.write(
      'usage: bootstrap-owner --email <email> --display-name <name> (BACKOFFICE_DATABASE_URL required)\n',
    );
    return 64;
  }
  const prisma = new BackofficeRuntimePrisma({
    url,
    poolMax: 1,
    applicationName: 'dormduri-backoffice-bootstrap',
  });
  try {
    const invitation = await issueBootstrapOwnerInvitation(
      {
        prisma,
        audit: new AdminAuditWriter(new BackofficeMetrics('bootstrap')),
        clock: new SystemClock(),
      },
      input.data,
    );
    process.stdout.write(
      `${JSON.stringify({ event: 'backoffice_bootstrap_owner_issued', code: invitation.code, expiresAt: invitation.expiresAt })}\n`,
    );
    return 0;
  } catch (error) {
    if (error instanceof BootstrapRefusedError) {
      process.stderr.write(`${JSON.stringify({ event: 'backoffice_bootstrap_owner_refused' })}\n`);
      return 2;
    }
    process.stderr.write(
      `${JSON.stringify({ event: 'backoffice_bootstrap_owner_failed', errorName: error instanceof Error ? error.name : 'UnknownError' })}\n`,
    );
    return 1;
  } finally {
    await prisma.close();
  }
}

process.exitCode = await main();
