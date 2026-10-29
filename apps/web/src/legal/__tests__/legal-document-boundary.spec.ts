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
      readSource('auth/flows/signup/SignupPageClient.tsx'),
      readSource('auth/flows/signup/components/LegalConsentStep.tsx'),
    ];

    for (const source of signupSources) {
      expect(source).not.toContain('@/constants/legal');
      expect(source).not.toContain('@/components/legal/LegalContentModal');
    }

    expect(existsSync(join(webSrc, 'components/legal/LegalContentModal.tsx'))).toBe(false);
    expect(existsSync(join(webSrc, 'constants/legal'))).toBe(false);
    expect(existsSync(join(webSrc, 'auth/flows/signup/components/StepTermsAgreement.tsx'))).toBe(
      false,
    );
  });

  it('signup legal component contract does not expose previous privacy consent compatibility', () => {
    const legalConsentStepSource = readSource('auth/flows/signup/components/LegalConsentStep.tsx');

    expect(legalConsentStepSource).not.toContain('@deprecated');
    expect(legalConsentStepSource).not.toContain('agreePrivacy');
  });

  it('public entry points expose user-facing legal links without internal planning copy', () => {
    const directLinkSources = [
      readSource('screens/landing/components/sections/Footer.tsx'),
      readSource('auth/flows/login/components/LoginSecondaryActions.tsx'),
      readSource('auth/components/layout/AuthServiceNotice.tsx'),
    ];
    const sharedNoticeConsumers = [
      readSource('auth/flows/login/components/LoginLayout.tsx'),
      readSource('auth/flows/signup/components/SignupLayout.tsx'),
    ];

    for (const source of directLinkSources) {
      expect(source).toContain('href="/terms"');
      expect(source).not.toMatch(/\.omx|web-terms-privacy-refactor-plan/i);
    }

    for (const source of sharedNoticeConsumers) {
      expect(source).toContain('AuthServiceNotice');
      expect(source).not.toMatch(/\.omx|web-terms-privacy-refactor-plan/i);
    }

    expect(directLinkSources.join('\n')).toContain('href="/privacy"');
    expect(directLinkSources.join('\n')).toMatch(/이용약관/);
    expect(directLinkSources.join('\n')).toMatch(/개인정보처리방침|개인정보 처리방침/);
  });
});
