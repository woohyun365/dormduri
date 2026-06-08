import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const socialSafetyRoot = join(apiSourceRoot, 'social-safety');
const supportRoot = join(apiSourceRoot, 'support');

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
  return relative(apiRoot, path);
}

function offendingFiles(root: string, forbidden: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => forbidden.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

describe('Phase 1 expected-red social-safety/support architecture boundary', () => {
  it('creates explicit social-safety and support module boundary documentation before implementation', () => {
    expect(existsSync(join(socialSafetyRoot, 'README.md'))).toBe(true);
    expect(existsSync(join(supportRoot, 'README.md'))).toBe(true);
  });

  it('keeps social-safety away from concrete chat/profile/match services and direct chat persistence', () => {
    const forbidden =
      /from\s+['"].*(?:chat\/application\/chat\.service|profiles\/.*service|matches\/.*service)|\bChatService\b|\bMatchesService\b|conversationThread\.(?:create|update|updateMany|delete|deleteMany|upsert)|conversationMessage\.(?:create|update|updateMany|delete|deleteMany|upsert)|matchRequest\.(?:create|update|updateMany|delete|deleteMany|upsert)|activeMatch\.(?:create|update|updateMany|delete|deleteMany|upsert)/;

    expect(offendingFiles(socialSafetyRoot, forbidden)).toEqual([]);
  });

  it('keeps block slice root production files limited to module/controller entrypoints', () => {
    const blockRoot = join(socialSafetyRoot, 'blocks');
    const rootProductionFiles = readdirSync(blockRoot)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .sort();

    expect(rootProductionFiles).toEqual(['block.controller.ts', 'block.module.ts']);
  });

  it('keeps report slice root production files limited to module/controller entrypoints', () => {
    const reportRoot = join(socialSafetyRoot, 'reports');
    const rootProductionFiles = readdirSync(reportRoot)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .sort();

    expect(rootProductionFiles).toEqual(['report.controller.ts', 'report.module.ts']);
  });

  it('keeps report intake from selecting raw chat message body or retained payloads', () => {
    const reportRoot = join(socialSafetyRoot, 'reports');
    const forbidden = /\bbody\s*:\s*true|retainedVaultObject|encryptedPayload|RetentionAccessLog/;

    expect(offendingFiles(reportRoot, forbidden)).toEqual([]);
  });

  it('keeps social-safety from mutating participant hidden/deactivated projection directly', () => {
    const forbidden =
      /seasonParticipant\.(?:update|updateMany|upsert)\s*\([\s\S]*?(hiddenByAdminAt|hiddenReasonCode|deactivatedAt)\s*:/;

    expect(offendingFiles(socialSafetyRoot, forbidden)).toEqual([]);
    expect(
      existsSync(join(socialSafetyRoot, 'application/ports/participant-visibility-writer.port.ts')),
    ).toBe(true);
  });

  it('keeps social-safety and support away from retained vault disclosure internals', () => {
    const forbidden =
      /from\s+['"].*(?:retention\/disclosure|retention\/.*vault|platform\/database\/retention-disclosure)|\bRetainedVaultObject\b|\bRetentionAccessLog\b/;

    expect(offendingFiles(socialSafetyRoot, forbidden)).toEqual([]);
    expect(offendingFiles(supportRoot, forbidden)).toEqual([]);
  });
});
