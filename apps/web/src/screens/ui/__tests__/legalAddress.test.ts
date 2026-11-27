import { LegalDocumentKind } from '@repo/shared/legal';
import { describe, expect, it } from 'vitest';
import {
  isPublicLegalDocumentKind,
  legalDocumentPaths,
  legalVersionHref,
} from '../model/legalAddress';
import { formatLegalDate } from '../model/legalDates';

describe('legal version addresses', () => {
  it('addresses the version in force by the document and the others by version key (G-LU5)', () => {
    expect(
      legalVersionHref(LegalDocumentKind.PRIVACY_POLICY, {
        versionKey: '2026-11-20',
        status: 'current',
      }),
    ).toBe('/privacy');
    expect(
      legalVersionHref(LegalDocumentKind.PRIVACY_POLICY, {
        versionKey: '2026-06-22',
        status: 'previous',
      }),
    ).toBe('/privacy?version=2026-06-22');
    expect(
      legalVersionHref(LegalDocumentKind.TERMS_OF_SERVICE, {
        versionKey: '2026-12-14',
        status: 'scheduled',
      }),
    ).toBe('/terms?version=2026-12-14');
  });

  it('knows the two documents that have a public address', () => {
    expect(Object.keys(legalDocumentPaths).sort()).toEqual([
      LegalDocumentKind.PRIVACY_POLICY,
      LegalDocumentKind.TERMS_OF_SERVICE,
    ]);
    expect(isPublicLegalDocumentKind(LegalDocumentKind.PRIVACY_POLICY)).toBe(true);
    expect(isPublicLegalDocumentKind(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE)).toBe(false);
    expect(isPublicLegalDocumentKind(LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT)).toBe(
      false,
    );
  });
});

describe('legal dates', () => {
  it('writes a version date and a document date the way readers say them', () => {
    expect(formatLegalDate('2026-06-22')).toBe('2026년 6월 22일');
    expect(formatLegalDate('2026-11-20T00:00:00.000Z')).toBe('2026년 11월 20일');
  });
});
