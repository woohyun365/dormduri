import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const noticesRoot = join(apiRoot, 'src/notices');

function rootTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'),
    )
    .map((entry) => entry.name)
    .sort();
}

function pathExists(relativePath: string) {
  return existsSync(join(noticesRoot, relativePath));
}

function readNoticeSource(relativePath: string) {
  return readFileSync(join(noticesRoot, relativePath), 'utf8');
}

function relativeNoticePath(relativePath: string) {
  return relative(noticesRoot, join(noticesRoot, relativePath));
}

describe('notices architecture boundary', () => {
  it('keeps root production surface limited to module and controller', () => {
    expect(rootTypeScriptFiles(noticesRoot)).toEqual([
      'notices.controller.ts',
      'notices.module.ts',
    ]);
  });

  it('keeps notice owner files in application/composition/errors/mappers/query/repository boundaries', () => {
    const requiredFiles = [
      'application/notices.service.ts',
      'composition/notices.providers.ts',
      'composition/notices.exports.ts',
      'errors/notices.errors.ts',
      'mappers/global-notice.presenter.ts',
      'queries/global-notice.query.ts',
      'queries/global-notice-list.cursor.ts',
      'repositories/global-notice.repository.ts',
    ];

    expect(requiredFiles.filter((relativePath) => !pathExists(relativePath))).toEqual([]);
  });

  it('keeps provider/export wiring readable from composition files', () => {
    const moduleSource = readNoticeSource('notices.module.ts');
    const providersSource = readNoticeSource('composition/notices.providers.ts');
    const exportsSource = readNoticeSource('composition/notices.exports.ts');

    expect(moduleSource).toContain('NOTICES_PROVIDERS');
    expect(moduleSource).toContain('NOTICES_EXPORTS');
    expect(providersSource).toContain('NoticesService');
    expect(providersSource).toContain('GlobalNoticeQuery');
    expect(providersSource).toContain('GlobalNoticeRepository');
    expect(exportsSource).toContain('NOTICES_EXPORTS');
  });

  it('keeps global notice presenter output on preview/detail shared contract fields only', () => {
    const presenterSource = readNoticeSource('mappers/global-notice.presenter.ts');

    expect(presenterSource).toContain('toGlobalNoticePreview');
    expect(presenterSource).toContain('toGlobalNotice');
    expect(presenterSource).not.toMatch(/recipientUserId|readAt|supportTicketId|reportId/);
  });

  it('keeps errors and mappers out of the root notices directory', () => {
    const forbiddenRootFiles = ['errors.ts', 'global-notice.presenter.ts'];

    expect(forbiddenRootFiles.filter((relativePath) => pathExists(relativePath))).toEqual([]);
    expect(relativeNoticePath('errors/notices.errors.ts')).toBe('errors/notices.errors.ts');
    expect(relativeNoticePath('mappers/global-notice.presenter.ts')).toBe(
      'mappers/global-notice.presenter.ts',
    );
  });
});
