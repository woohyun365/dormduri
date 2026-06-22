import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSrc = join(process.cwd(), 'src');

function readSource(path: string): string {
  return readFileSync(join(webSrc, path), 'utf8');
}

function listSourceFiles(root: string): string[] {
  const absoluteRoot = join(webSrc, root);
  return readdirSync(absoluteRoot).flatMap((entry) => {
    const absolutePath = join(absoluteRoot, entry);
    const relativePath = join(root, entry);
    if (statSync(absolutePath).isDirectory()) {
      return listSourceFiles(relativePath);
    }
    if (relativePath.includes('__tests__')) {
      return [];
    }
    return /\.(ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
}

describe('web legal document boundary', () => {
  it('/terms and /privacy routes do not depend on legacy constants or root LegalPage', () => {
    const routeSources = [readSource('app/terms/page.tsx'), readSource('app/privacy/page.tsx')];

    for (const source of routeSources) {
      expect(source).not.toContain('@/constants/legal');
      expect(source).not.toContain('@/components/LegalPage');
      expect(source).toContain("export const dynamic = 'force-dynamic'");
    }

    expect(existsSync(join(webSrc, 'components/LegalPage.tsx'))).toBe(false);
  });

  it('legal feature does not import legacy legal constants or signup internals', () => {
    const legalSources = listSourceFiles('legal').map(readSource);

    for (const source of legalSources) {
      expect(source).not.toContain('@/constants/legal');
      expect(source).not.toContain('@/signup/');
    }
  });

  it('signup legal consent flow uses legal feature instead of legacy static modal/constants', () => {
    const signupSources = [
      readSource('signup/Signup.tsx'),
      readSource('signup/components/StepTermsAgreement.tsx'),
    ];

    for (const source of signupSources) {
      expect(source).not.toContain('@/constants/legal');
      expect(source).not.toContain('@/components/legal/LegalContentModal');
    }

    expect(existsSync(join(webSrc, 'components/legal/LegalContentModal.tsx'))).toBe(false);
    expect(existsSync(join(webSrc, 'constants/legal'))).toBe(false);
  });
});
