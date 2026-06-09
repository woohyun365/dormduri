import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

type PackageExportTarget = { types: string; default: string };
type PackageJson = { exports: Record<string, PackageExportTarget | undefined> };

const EXCLUDED_API_DOMAIN_SEGMENTS = new Set([
  'retention',
  'matches',
  'config',
  'health',
  'profiles',
]);

const COMPAT_EXPORTS = [
  './auth-contract',
  './auth-policy',
  './auth-response',
  './chat-contract',
  './dormitory-contract',
  './season-contract',
  './session-contract',
] as const;

const COMPAT_SOURCE_FILES = [
  'auth-contract.ts',
  'auth-policy.ts',
  'auth-response.ts',
  'chat-contract.ts',
  'dormitory-contract.ts',
  'season-contract.ts',
  'session-contract.ts',
] as const;

const ROOT_STYLE_ALIAS_EXPORTS = [
  './chat-realtime-contract',
  './chat-realtime-events',
  './notification-contract',
  './support-contract',
] as const;

const INCLUDED_NEUTRAL_ROOT_FILES = [
  'campus-contract.ts',
  'college-contract-catalog.ts',
  'college-contract-lookups.ts',
  'college-contract-schema.ts',
  'college-contract.ts',
  'date-primitives.ts',
  'identity-contract.ts',
  'lifestyle-options.ts',
  'lifestyle-schema.ts',
  'lifestyle.ts',
] as const;

const EXCLUDED_OWNER_ROOT_FILES = [
  'match-contract-enums.ts',
  'match-contract-history.ts',
  'match-contract-request.ts',
  'match-contract-response.ts',
  'match-contract-summary.ts',
  'match-contract.ts',
  'match-score.ts',
  'profile-contract-fields.ts',
  'profile-contract-public.ts',
  'profile-contract.ts',
  'roommate-search-contract.ts',
] as const;

const TRANSITIONAL_PUBLIC_SPECIFIERS = [
  '@repo/shared/auth-contract',
  '@repo/shared/auth-policy',
  '@repo/shared/auth-response',
  '@repo/shared/chat-contract',
  '@repo/shared/chat-realtime-contract',
  '@repo/shared/chat-realtime-events',
  '@repo/shared/dormitory-contract',
  '@repo/shared/notification-contract',
  '@repo/shared/season-contract',
  '@repo/shared/session-contract',
  '@repo/shared/support-contract',
] as const;

function findRepoRoot() {
  let current = process.cwd();

  while (!existsSync(join(current, 'packages/shared/src'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('repo root with packages/shared/src not found');
    }
    current = parent;
  }

  return current;
}

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

function repoRelativePath(path: string) {
  return relative(repoRoot, path).split(sep).join('/');
}

function readPackageJson() {
  return JSON.parse(
    readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8'),
  ) as PackageJson;
}

function exportTargetIncludesCompat(target: PackageExportTarget | undefined) {
  return Boolean(target?.default.includes('/compat/') || target?.types.includes('/compat/'));
}

function isIncludedApiSource(path: string) {
  const relativeToApiSrc = relative(apiSrc, path).split(sep);
  return !relativeToApiSrc.some((segment) => EXCLUDED_API_DOMAIN_SEGMENTS.has(segment));
}

const repoRoot = findRepoRoot();
const sharedSrc = join(repoRoot, 'packages/shared/src');
const compatSrc = join(sharedSrc, 'compat');
const apiSrc = join(repoRoot, 'apps/api/src');
const ignoredSelf =
  'apps/api/src/architecture/contracts/layout/shared-contract-source-of-truth-layout.spec.ts';

describe('shared contract source-of-truth layout', () => {
  it('keeps current dist/compat public exports as a transitional allowlist only', () => {
    const sharedPackageJson = readPackageJson();

    const compatExports = Object.entries(sharedPackageJson.exports)
      .filter(([, target]) => exportTargetIncludesCompat(target))
      .map(([publicPath]) => publicPath)
      .sort();

    expect(compatExports).toEqual([...COMPAT_EXPORTS].sort());
  });

  it('keeps compat source files as a transitional allowlist only', () => {
    const compatFiles = readdirSync(compatSrc, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)
      .sort();

    expect(compatFiles).toEqual([...COMPAT_SOURCE_FILES].sort());
  });

  it('records root-style public alias exports that still need canonical handoff', () => {
    const sharedPackageJson = readPackageJson();

    const rootStyleAliasExports = ROOT_STYLE_ALIAS_EXPORTS.filter(
      (publicPath) => sharedPackageJson.exports[publicPath] !== undefined,
    ).sort();

    expect(rootStyleAliasExports).toEqual([...ROOT_STYLE_ALIAS_EXPORTS].sort());
  });

  it('records nested source owners that still miss canonical package exports', () => {
    const sharedPackageJson = readPackageJson();
    const canonicalExportGaps = [
      { source: 'chat/index.ts', publicPath: './chat' },
      { source: 'notifications/index.ts', publicPath: './notifications' },
    ]
      .filter(({ source, publicPath }) => {
        return (
          existsSync(join(sharedSrc, source)) && sharedPackageJson.exports[publicPath] === undefined
        );
      })
      .map(({ publicPath, source }) => ({ publicPath, source }));

    expect(canonicalExportGaps).toEqual([
      { publicPath: './chat', source: 'chat/index.ts' },
      { publicPath: './notifications', source: 'notifications/index.ts' },
    ]);
  });

  it('keeps root shared files partitioned between neutral migration targets and excluded owners', () => {
    const rootTypeScriptFiles = readdirSync(sharedSrc, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)
      .sort();

    expect(rootTypeScriptFiles).toEqual(
      [...INCLUDED_NEUTRAL_ROOT_FILES, ...EXCLUDED_OWNER_ROOT_FILES].sort(),
    );
  });

  it('observes included API source imports that still use transitional shared public paths', () => {
    const transitionalImportOffenders = walkTypeScriptFiles(apiSrc)
      .filter((path) => repoRelativePath(path) !== ignoredSelf)
      .filter(isIncludedApiSource)
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        const specifiers = TRANSITIONAL_PUBLIC_SPECIFIERS.filter((specifier) =>
          source.includes(specifier),
        );

        return specifiers.length > 0
          ? [{ path: repoRelativePath(path), specifiers: [...specifiers].sort() }]
          : [];
      })
      .sort((a, b) => a.path.localeCompare(b.path));

    expect(transitionalImportOffenders).toEqual([
      {
        path: 'apps/api/src/auth/application/auth.service.ts',
        specifiers: ['@repo/shared/auth-response'],
      },
      { path: 'apps/api/src/auth/auth.controller.ts', specifiers: ['@repo/shared/auth-contract'] },
      {
        path: 'apps/api/src/auth/contracts/auth-shared-contract.spec.ts',
        specifiers: [
          '@repo/shared/auth-contract',
          '@repo/shared/auth-response',
          '@repo/shared/session-contract',
        ],
      },
      {
        path: 'apps/api/src/auth/credentials/change-password.command.ts',
        specifiers: ['@repo/shared/auth-response'],
      },
      {
        path: 'apps/api/src/auth/domain/auth.constants.ts',
        specifiers: ['@repo/shared/auth-policy'],
      },
      {
        path: 'apps/api/src/auth/domain/auth.types.ts',
        specifiers: ['@repo/shared/auth-response', '@repo/shared/session-contract'],
      },
      { path: 'apps/api/src/auth/domain/auth.utils.ts', specifiers: ['@repo/shared/auth-policy'] },
      {
        path: 'apps/api/src/auth/errors/auth-failures.ts',
        specifiers: ['@repo/shared/auth-response'],
      },
      {
        path: 'apps/api/src/auth/registration/auth-registration-use-cases.service.ts',
        specifiers: ['@repo/shared/auth-response'],
      },
      {
        path: 'apps/api/src/auth/registration/auth-signup-validation.service.ts',
        specifiers: ['@repo/shared/auth-policy', '@repo/shared/auth-response'],
      },
      {
        path: 'apps/api/src/chat/application/chat.service.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      { path: 'apps/api/src/chat/chat.controller.ts', specifiers: ['@repo/shared/chat-contract'] },
      {
        path: 'apps/api/src/chat/commands/chat-command.helpers.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/commands/chat-command.types.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/commands/leave-thread.command.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/commands/send-message.command.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/commands/update-read-marker.command.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/contracts/chat-realtime-contract.spec.ts',
        specifiers: [
          '@repo/shared/chat-contract',
          '@repo/shared/chat-realtime-contract',
          '@repo/shared/chat-realtime-events',
        ],
      },
      {
        path: 'apps/api/src/chat/events/chat-realtime-event.mapper.ts',
        specifiers: ['@repo/shared/chat-realtime-events'],
      },
      {
        path: 'apps/api/src/chat/mappers/chat-thread-presenter.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/pairs/chat-pair-entry.query.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/policies/chat-thread-permission.policy.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/queries/chat-thread-query.service.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/chat/realtime/chat-realtime.metrics.ts',
        specifiers: ['@repo/shared/chat-contract'],
      },
      {
        path: 'apps/api/src/dormitories/contracts/dormitory-contract.spec.ts',
        specifiers: ['@repo/shared/dormitory-contract'],
      },
      {
        path: 'apps/api/src/dormitories/guides/dormitory-guide.mapper.ts',
        specifiers: ['@repo/shared/dormitory-contract'],
      },
      {
        path: 'apps/api/src/notifications/application/notifications.service.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/notifications/application/ports/notification-writer.port.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/notifications/campaigns/create-notification-campaign.command.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/notifications/campaigns/notification-campaign-fanout.service.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/notifications/contracts/notification-contract.spec.ts',
        specifiers: [
          '@repo/shared/chat-contract',
          '@repo/shared/chat-realtime-events',
          '@repo/shared/notification-contract',
        ],
      },
      {
        path: 'apps/api/src/notifications/mappers/notification-presenter.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/notifications/outbox/notification-dispatcher.service.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/notifications/queries/notification-query.service.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/platform/http/zod-request.spec.ts',
        specifiers: ['@repo/shared/auth-contract'],
      },
      {
        path: 'apps/api/src/season-participants/capabilities/current-user-capabilities.policy.ts',
        specifiers: ['@repo/shared/dormitory-contract'],
      },
      {
        path: 'apps/api/src/season-participants/contracts/season-participation-contract.spec.ts',
        specifiers: ['@repo/shared/season-contract'],
      },
      {
        path: 'apps/api/src/season-participants/policies/season-participant-selection.policy.ts',
        specifiers: ['@repo/shared/dormitory-contract'],
      },
      {
        path: 'apps/api/src/season-participants/policies/season-participant-status.policy.ts',
        specifiers: ['@repo/shared/dormitory-contract'],
      },
      {
        path: 'apps/api/src/season-participants/public-target-policy/public-target-policy.types.ts',
        specifiers: ['@repo/shared/dormitory-contract'],
      },
      {
        path: 'apps/api/src/seasons/contracts/season-contract.spec.ts',
        specifiers: ['@repo/shared/season-contract'],
      },
      {
        path: 'apps/api/src/social-safety/reports/contracts/report-contract.spec.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/social-safety/reports/notifications/report-notification.service.ts',
        specifiers: ['@repo/shared/notification-contract'],
      },
      {
        path: 'apps/api/src/support/application/support.service.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/commands/append-support-ticket-message.command.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/commands/create-support-ticket.command.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/commands/reply-support-ticket.command.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/commands/resolve-support-ticket.command.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/contracts/support-contract.spec.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/notifications/support-notification.service.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/policies/support-ticket-status.policy.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/presenters/support-faq.presenter.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/presenters/support-ticket.presenter.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/queries/support-faq.query.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/queries/support-ticket-detail.query.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/queries/support-ticket-list.query.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/repositories/support-faq.repository.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/repositories/support-ticket.repository.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/support/support.controller.ts',
        specifiers: ['@repo/shared/support-contract'],
      },
      {
        path: 'apps/api/src/users/identity/display/update-display-identity.command.ts',
        specifiers: ['@repo/shared/auth-policy'],
      },
    ]);
  });
});
