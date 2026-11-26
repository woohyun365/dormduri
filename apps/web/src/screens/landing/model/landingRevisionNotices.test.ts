import { LegalDocumentKind, type LegalRevisionNotice } from '@repo/shared/legal';
import { describe, expect, it } from 'vitest';
import {
  INTERNAL_COPY_PATTERN,
  RAW_ID_PATTERN,
  copyStrings,
} from '@/screens/ui/__tests__/userCopyChecks';
import { formatLegalDate } from '@/screens/ui/model/legalDates';
import { landingCopy } from './landingCopy';
import { toLandingRevisionLines } from './landingRevisionNotices';

function notice(kind: LegalRevisionNotice['kind'], versionKey: string): LegalRevisionNotice {
  return {
    kind,
    versionKey,
    status: 'scheduled',
    appliesFrom: versionKey,
    appliesUntil: null,
    changeSummary: '변경 요약',
    consentRequired: false,
  };
}

describe('landing revision lines', () => {
  it('keeps only the public documents, privacy first (D-LU17)', () => {
    expect(
      toLandingRevisionLines([
        notice(LegalDocumentKind.TERMS_OF_SERVICE, '2026-12-14'),
        notice(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE, '2026-12-10'),
        notice(LegalDocumentKind.PRIVACY_POLICY, '2026-12-21'),
        notice(LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT, '2026-12-10'),
      ]),
    ).toEqual([
      {
        kind: LegalDocumentKind.PRIVACY_POLICY,
        versionKey: '2026-12-21',
        appliesFrom: '2026-12-21',
      },
      {
        kind: LegalDocumentKind.TERMS_OF_SERVICE,
        versionKey: '2026-12-14',
        appliesFrom: '2026-12-14',
      },
    ]);
    expect(toLandingRevisionLines([])).toEqual([]);
  });

  it('keeps one line per document: the version that applies first', () => {
    expect(
      toLandingRevisionLines([
        notice(LegalDocumentKind.PRIVACY_POLICY, '2027-01-20'),
        notice(LegalDocumentKind.PRIVACY_POLICY, '2026-12-21'),
      ]),
    ).toEqual([
      {
        kind: LegalDocumentKind.PRIVACY_POLICY,
        versionKey: '2026-12-21',
        appliesFrom: '2026-12-21',
      },
    ]);
  });

  it('names no plan, issue, internal path, raw id or internal state in the band copy (D-LU17, G-LU10)', () => {
    const strings = copyStrings(landingCopy.revisionNotice, [
      formatLegalDate('2026-12-14'),
      landingCopy.footer.privacyLabel,
    ]);
    expect(strings).toHaveLength(3);
    for (const text of strings) {
      expect(text).not.toMatch(INTERNAL_COPY_PATTERN);
      expect(text).not.toMatch(RAW_ID_PATTERN);
    }
  });
});
