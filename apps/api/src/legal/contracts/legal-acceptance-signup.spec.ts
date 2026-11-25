import { describe, expect, it, vi } from 'vitest';
import {
  LegalAcceptanceAction,
  LegalDocumentKind,
  type SignupLegalAcceptances,
} from '@repo/shared/legal';
import {
  createSignupLegalAcceptanceRecords,
  resolveSignupLegalAcceptances,
  SIGNUP_LEGAL_ACCEPTANCE_REQUIREMENTS,
  SIGNUP_LEGAL_ACCEPTANCE_STALE,
} from '../commands/record-legal-acceptance.command.js';

const acceptedAt = new Date('2026-06-22T00:00:00.000Z');
const activeIds: Record<LegalDocumentKind, string> = {
  [LegalDocumentKind.TERMS_OF_SERVICE]: 'terms-of-service-2026-06-22',
  [LegalDocumentKind.PRIVACY_POLICY]: 'privacy-policy-2026-06-22',
  [LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT]:
    'personal-data-collection-use-consent-2026-06-22',
  [LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE]: 'age-14-or-above-notice-2026-06-22',
};
const legalAcceptances: SignupLegalAcceptances = {
  termsVersionId: activeIds.TERMS_OF_SERVICE,
  personalDataConsentVersionId: activeIds.PERSONAL_DATA_COLLECTION_USE_CONSENT,
  ageNoticeVersionId: activeIds.AGE_14_OR_ABOVE_NOTICE,
  privacyPolicyVersionIdShown: activeIds.PRIVACY_POLICY,
};

function resolveKind(args: unknown): LegalDocumentKind {
  const kinds = (args as { where?: { kind?: { in?: unknown } } } | null)?.where?.kind?.in;
  if (!Array.isArray(kinds) || kinds.length !== 1 || typeof kinds[0] !== 'string') {
    throw new Error('where.kind.in with one kind is required');
  }
  return kinds[0] as LegalDocumentKind;
}

/** Published versions as the database returns them: the version in effect and, for terms, a scheduled one. */
function publishedVersions(args: unknown) {
  const kind = resolveKind(args);
  const version = (id: string, effectiveDate: string, noticeClass: string) => ({
    id,
    kind,
    version: id,
    title: `${kind} 문서`,
    contentSchemaVersion: 1,
    summaryItems: [],
    sections: [{ type: 'paragraph', text: '본문' }],
    changeSummary: '변경 요약',
    noticeClass,
    consentRequired: false,
    effectiveDate: new Date(`${effectiveDate}T00:00:00.000Z`),
    appliesUntil: null,
    publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    withdrawnAt: null,
  });
  const rows = [version(activeIds[kind], '2026-06-22', 'INITIAL')];
  if (kind === LegalDocumentKind.TERMS_OF_SERVICE) {
    // Notice started but not in effect at signup time: never the agreed version.
    rows.push(version('terms-of-service-2026-07-01', '2026-07-01', 'GENERAL'));
  }
  return Promise.resolve(rows);
}

describe('signup legal acceptance command contract', () => {
  it('signup input fields를 required legal document kind와 action에 매핑한다', () => {
    expect(SIGNUP_LEGAL_ACCEPTANCE_REQUIREMENTS).toEqual([
      {
        field: 'termsVersionId',
        kind: LegalDocumentKind.TERMS_OF_SERVICE,
        action: LegalAcceptanceAction.AGREE,
      },
      {
        field: 'personalDataConsentVersionId',
        kind: LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        action: LegalAcceptanceAction.AGREE,
      },
      {
        field: 'ageNoticeVersionId',
        kind: LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
        action: LegalAcceptanceAction.AGREE,
      },
      {
        field: 'privacyPolicyVersionIdShown',
        kind: LegalDocumentKind.PRIVACY_POLICY,
        action: LegalAcceptanceAction.SHOW,
      },
    ]);
  });

  it('active document id와 요청 id가 모두 일치할 때 persistence payload를 만든다', async () => {
    const tx = {
      legalDocumentVersion: {
        findMany: vi.fn(publishedVersions),
      },
      legalAcceptanceRecord: {
        createMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    };

    const resolved = await resolveSignupLegalAcceptances(tx as never, legalAcceptances, acceptedAt);
    await createSignupLegalAcceptanceRecords(tx as never, 'user-1', resolved);

    expect(tx.legalDocumentVersion.findMany).toHaveBeenCalledTimes(4);
    const findManyCalls = tx.legalDocumentVersion.findMany.mock.calls as unknown as Array<
      [{ where: unknown }]
    >;
    // Only published versions whose notice started, without withdrawn ones, at the signup clock.
    expect(findManyCalls[0]?.[0].where).toEqual({
      kind: { in: [LegalDocumentKind.TERMS_OF_SERVICE] },
      withdrawnAt: null,
      publishedAt: { lte: acceptedAt },
    });
    expect(tx.legalAcceptanceRecord.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user-1',
          documentVersionId: activeIds.TERMS_OF_SERVICE,
          kind: LegalDocumentKind.TERMS_OF_SERVICE,
          action: LegalAcceptanceAction.AGREE,
          acceptedAt,
          source: 'SIGNUP',
        },
        {
          userId: 'user-1',
          documentVersionId: activeIds.PERSONAL_DATA_COLLECTION_USE_CONSENT,
          kind: LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
          action: LegalAcceptanceAction.AGREE,
          acceptedAt,
          source: 'SIGNUP',
        },
        {
          userId: 'user-1',
          documentVersionId: activeIds.AGE_14_OR_ABOVE_NOTICE,
          kind: LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
          action: LegalAcceptanceAction.AGREE,
          acceptedAt,
          source: 'SIGNUP',
        },
        {
          userId: 'user-1',
          documentVersionId: activeIds.PRIVACY_POLICY,
          kind: LegalDocumentKind.PRIVACY_POLICY,
          action: LegalAcceptanceAction.SHOW,
          acceptedAt,
          source: 'SIGNUP',
        },
      ],
    });
  });

  it('active document가 없거나 요청 id가 stale이면 저장 전에 fail-closed 한다', async () => {
    const tx = {
      legalDocumentVersion: {
        findMany: vi.fn(publishedVersions),
      },
      legalAcceptanceRecord: {
        createMany: vi.fn(),
      },
    };

    await expect(
      resolveSignupLegalAcceptances(
        tx as never,
        { ...legalAcceptances, ageNoticeVersionId: 'old-age-document-id' },
        acceptedAt,
      ),
    ).rejects.toThrow(SIGNUP_LEGAL_ACCEPTANCE_STALE);

    expect(tx.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
  });
});
