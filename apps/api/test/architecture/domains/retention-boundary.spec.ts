import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const sqlRoot = join(apiRoot, 'prisma/sql');
const retentionRoot = join(apiSourceRoot, 'retention');
const lifecycleRoot = join(apiSourceRoot, 'lifecycle');

const productDomainRoots = [
  'auth',
  'chat',
  'matches',
  'notifications',
  'profiles',
  'season-participants',
  'seasons',
  'social-safety',
  'support',
  'users',
] as const;

const removedUsersRetentionSweepPortName = ['USER', 'RETENTION', 'SWEEP', 'PORT'].join('_');

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

function sourceFilesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

describe('retention product architecture boundary', () => {
  it('keeps lifecycle sweep tasks on the retention sweep port', () => {
    const lifecycleSweepAdapterSource = readSource(
      join(lifecycleRoot, 'adapters/lifecycle-sweep-tasks.adapter.ts'),
    );

    expect(
      lifecycleSweepAdapterSource.match(new RegExp(removedUsersRetentionSweepPortName, 'g')),
    ).toBeNull();
    expect(lifecycleSweepAdapterSource).toContain('RETENTION_SWEEP_PORT');
    expect(sourceFilesContaining(lifecycleRoot, /UsersService|users\.service/)).toEqual([]);
  });

  it('keeps queue-like retention SQL bounded, ordered, and skip-locked', () => {
    const archiveClaimSql = readSource(join(sqlRoot, 'claimRetentionArchiveJobs.sql'));
    const reviewClaimSql = readSource(join(sqlRoot, 'claimRetentionReviewJobs.sql'));
    const accessLogDisposalSql = readSource(join(sqlRoot, 'disposeDueRetentionAccessLogs.sql'));

    expect({
      archiveClaim: {
        skipLocked: /FOR UPDATE SKIP LOCKED/.test(archiveClaimSql),
        deterministicOrder: /ORDER BY "nextRunAt" ASC, "createdAt" ASC, "id" ASC/.test(
          archiveClaimSql,
        ),
        boundedLimit: /LIMIT \$3/.test(archiveClaimSql),
        ownsUpdatedAt: /"updatedAt"\s*=\s*\$1/.test(archiveClaimSql),
      },
      reviewClaim: {
        skipLocked: /FOR UPDATE SKIP LOCKED/.test(reviewClaimSql),
        deterministicOrder: /ORDER BY "dueAt" ASC, "createdAt" ASC, "id" ASC/.test(reviewClaimSql),
        boundedLimit: /LIMIT \$3/.test(reviewClaimSql),
        ownsUpdatedAt: /"updatedAt"\s*=\s*\$1/.test(reviewClaimSql),
      },
      accessLogDisposal: {
        skipLocked: /FOR UPDATE SKIP LOCKED/.test(accessLogDisposalSql),
        deterministicOrder: /ORDER BY "logRetentionHoldUntil" ASC, "id" ASC/.test(
          accessLogDisposalSql,
        ),
        boundedLimit: /LIMIT \$2/.test(accessLogDisposalSql),
        avoidsRawPayloadColumns: !/"(?:encryptedIdentifierPayload|encryptedPayload|payload)"/.test(
          accessLogDisposalSql,
        ),
      },
    }).toEqual({
      archiveClaim: {
        skipLocked: true,
        deterministicOrder: true,
        boundedLimit: true,
        ownsUpdatedAt: true,
      },
      reviewClaim: {
        skipLocked: true,
        deterministicOrder: true,
        boundedLimit: true,
        ownsUpdatedAt: true,
      },
      accessLogDisposal: {
        skipLocked: true,
        deterministicOrder: true,
        boundedLimit: true,
        avoidsRawPayloadColumns: true,
      },
    });
  });

  it('keeps archive target registry as thin dispatch without source row transformations', () => {
    const registrySource = readSource(
      join(retentionRoot, 'archive-jobs/targets/archive-target-handlers.ts'),
    );
    const expectedOwnerHandlerFiles = [
      join(apiSourceRoot, 'users/identity/retention/nickname-audit-archive.handler.ts'),
      join(apiSourceRoot, 'users/identity/retention/academic-identity-audit-archive.handler.ts'),
      join(
        apiSourceRoot,
        'season-participants/retention/season-profile-history-archive.handler.ts',
      ),
      join(apiSourceRoot, 'matches/history/retention/match-history-archive.handler.ts'),
      join(apiSourceRoot, 'chat/retention/thread-retention-archive.handler.ts'),
      join(apiSourceRoot, 'chat/retention/conversation-retained-body.service.ts'),
    ];

    expect(
      expectedOwnerHandlerFiles.filter((file) => !existsSync(file)).map(relativeSourcePath),
    ).toEqual([]);
    expect(/retainVaultPayloadTx|ensureRetentionCaseTx/.test(registrySource)).toBe(false);
    expect(
      /UserDisplayIdentityNicknameChangeEvent|UserAcademicIdentityChangeEvent|SeasonParticipantProfileHistory|SeasonMatchHistoryEntry|ConversationMessage/.test(
        registrySource,
      ),
    ).toBe(false);
  });

  it('keeps product read paths away from retained payload disclosure/parser internals', () => {
    const forbiddenDisclosureOrParserImports =
      /from\s+['"][^'"]*retention\/(?:vault\/[^'"]*disclosure|retained-vault-owner|conversation-retained-body-owner)(?:\.js)?['"]/;
    const productRoots = productDomainRoots.map((root) => join(apiSourceRoot, root));
    const offenders = productRoots.flatMap((root) =>
      sourceFilesContaining(root, forbiddenDisclosureOrParserImports),
    );

    expect(offenders).toEqual([]);
  });
});
