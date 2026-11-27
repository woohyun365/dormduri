import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('../../..', import.meta.url));
const rule = 'import/no-restricted-paths';

// Fixture paths do not exist on disk, so the TypeScript projects cannot parse them; the rule needs only the import
// resolver (presentation-lint.test.ts lints its fixtures the same way).
const untypedParse: Linter.Config = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: { parserOptions: { projectService: false, project: null } },
};
const linter = new ESLint({ cwd: webRoot, overrideConfig: [untypedParse] });

async function errorsOf(filePath: string, source: string) {
  const [result] = await linter.lintText(`${source}\n`, {
    filePath: path.join(webRoot, filePath),
  });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  return result.messages.filter((message) => message.ruleId === rule && message.severity === 2);
}

// The test-only legal seed path (apps/web/src/legal/test-support) stays out of production code.
describe('test-only legal seed import boundary', () => {
  it.each([
    [
      'src/legal/api/legal-copy-check.ts',
      "import { seedActiveLegalDocument } from '@/legal/test-support/legal-seed-documents';",
    ],
    [
      'src/legal/api/legal-copy-check.ts',
      "import { seedActiveLegalDocument } from '../test-support/legal-seed-documents';",
    ],
    [
      'src/app/privacy/page.tsx',
      "import { LEGAL_SEED_SOURCE } from '@/legal/test-support/legal-seed-source.mjs';",
    ],
    [
      'src/screens/legal/model/legalDocumentModel.ts',
      "export { seedActiveLegalDocument } from '@/legal/test-support/legal-seed-documents';",
    ],
  ])('rejects %s importing the seed path', async (filePath, source) => {
    expect(await errorsOf(filePath, source)).toHaveLength(1);
  });

  it.each([
    ['src/legal/__tests__/legal-copy.test.ts'],
    ['src/auth/flows/signup/components/__tests__/LegalConsentStep.test.tsx'],
    ['src/legal/__stories__/LegalDocumentPages.stories.tsx'],
    ['src/auth/stories/fixtures/auth-story-fixtures.ts'],
    ['src/screens/legal/__stories__/storyDocuments.ts'],
  ])('lets the test or story file %s import it', async (filePath) => {
    expect(
      await errorsOf(
        filePath,
        "import { seedActiveLegalDocument } from '@/legal/test-support/legal-seed-documents';",
      ),
    ).toEqual([]);
  });
});
