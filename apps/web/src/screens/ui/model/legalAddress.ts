// Type-only imports: the Legal e2e and Storybook tests import the copy and model built on this file,
// and the Playwright loader cannot load the @repo/shared build (e2e/support/legal-last-success-fixture.ts).
import type { LegalDocumentKind, LegalVersionStatus } from '@repo/shared/legal';

// The public legal documents and their addresses: the version in force at the document's own address,
// any other version at `?version=<versionKey>` (its effective date, YYYY-MM-DD). The Legal screens and
// the Landing revision line link to versions with the same function.

export type PublicLegalDocumentKind =
  typeof LegalDocumentKind.TERMS_OF_SERVICE | typeof LegalDocumentKind.PRIVACY_POLICY;

export const legalDocumentPaths = {
  TERMS_OF_SERVICE: '/terms',
  PRIVACY_POLICY: '/privacy',
} as const satisfies Record<PublicLegalDocumentKind, string>;

export function isPublicLegalDocumentKind(kind: string): kind is PublicLegalDocumentKind {
  return Object.hasOwn(legalDocumentPaths, kind);
}

export function legalVersionHref(
  kind: PublicLegalDocumentKind,
  version: { versionKey: string; status: LegalVersionStatus },
): string {
  const path = legalDocumentPaths[kind];
  return version.status === 'current' ? path : `${path}?version=${version.versionKey}`;
}
