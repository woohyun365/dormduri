import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiSourceRoot = join(process.cwd(), 'src');
const supportRoot = join(apiSourceRoot, 'support');

const publicFaqReadPathFiles = [
  'queries/support-faq.query.ts',
  'repositories/support-faq.repository.ts',
  'presenters/support-faq.presenter.ts',
] as const;

function readSupportSource(relativePath: string) {
  return readFileSync(join(supportRoot, relativePath), 'utf8');
}

describe('support public FAQ architecture boundary', () => {
  it('keeps public FAQ read path independent from private user/report/ticket persistence', () => {
    const forbiddenImportPattern =
      /from\s+['"]\.\.\/(?:tickets|notifications|reports|blocks|bookmarks|retention|users|auth|social-safety|operations)\//;
    const offendingFiles = publicFaqReadPathFiles.filter((relativePath) =>
      forbiddenImportPattern.test(readSupportSource(relativePath)),
    );

    expect(offendingFiles.map((path) => relative(supportRoot, join(supportRoot, path)))).toEqual(
      [],
    );
  });

  it('keeps FAQ presenter output on the public shared FAQ contract fields only', () => {
    const presenter = readSupportSource('presenters/support-faq.presenter.ts');

    expect(presenter).not.toMatch(/placementId|articleId|operator|memo|note|createdAt/);
    expect(presenter).toContain('id: record.id');
    expect(presenter).toContain('question: record.question');
    expect(presenter).toContain('answer: record.answer');
    expect(presenter).toContain('sortOrder: record.sortOrder');
  });
});
