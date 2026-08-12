import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');
const prismaModulePath = join(sourceRoot, 'platform/database/prisma.module.ts');

const prismaModuleImportBaseline = [
  'src/auth/auth.module.ts',
  'src/auth/operations/auth-operations.module.ts',
  'src/chat/chat.module.ts',
  'src/chat/lifecycle/chat-lifecycle.module.ts',
  'src/dormitories/dormitories.module.ts',
  'src/health/health.module.ts',
  'src/home-dashboard/home-dashboard.module.ts',
  'src/legal/legal.module.ts',
  'src/lifecycle/lifecycle.module.ts',
  'src/matches/matches.module.ts',
  'src/moderation/moderation.module.ts',
  'src/notices/notices.module.ts',
  'src/notifications/notifications.module.ts',
  'src/platform/database/prisma.module.ts',
  'src/profiles/profiles.module.ts',
  'src/retention/retention.module.ts',
  'src/roommate-search/roommate-search.module.ts',
  'src/season-participants/season-participants.module.ts',
  'src/seasons/seasons.module.ts',
  'src/social-safety/blocks/block.module.ts',
  'src/social-safety/bookmarks/bookmark.module.ts',
  'src/social-safety/enforcements/enforcement-notice.module.ts',
  'src/social-safety/reports/report.module.ts',
  'src/support/support.module.ts',
  'src/users/current-user/current-user-view.module.ts',
  'src/users/identity/display/display-identity.module.ts',
  'src/users/users.module.ts',
] as const;

describe('Prisma module dependency boundary', () => {
  it('records every module that currently imports PrismaModule', () => {
    const importers = walkTypeScriptFiles(sourceRoot)
      .filter((path) => path.endsWith('.module.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes('PrismaModule'))
      .map((path) => relative(apiRoot, path).replaceAll('\\', '/'))
      .sort();

    expect(importers).toEqual([...prismaModuleImportBaseline]);
  });

  it('requires Prisma dependencies to be explicit instead of global', () => {
    expect(readFileSync(prismaModulePath, 'utf8')).not.toMatch(/@Global\s*\(\s*\)/u);
  });
});

function walkTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}
