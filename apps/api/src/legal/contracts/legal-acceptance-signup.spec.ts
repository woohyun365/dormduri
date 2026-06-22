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
  if (typeof args !== 'object' || args === null || !('where' in args)) {
    throw new Error('where.kind is required');
  }
  const where = (args as { where?: { kind?: unknown } }).where;
  if (typeof where?.kind !== 'string') {
    throw new Error('where.kind is required');
  }
  return where.kind as LegalDocumentKind;
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
        findFirst: vi.fn((args: unknown) => Promise.resolve({ id: activeIds[resolveKind(args)] })),
      },
      legalAcceptanceRecord: {
        createMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    };

    const resolved = await resolveSignupLegalAcceptances(tx as never, legalAcceptances, acceptedAt);
    await createSignupLegalAcceptanceRecords(tx as never, 'user-1', resolved);

    expect(tx.legalDocumentVersion.findFirst).toHaveBeenCalledTimes(4);
    const findFirstCalls = tx.legalDocumentVersion.findFirst.mock.calls as Array<
      [
        {
          where: {
            kind: LegalDocumentKind;
            publishedAt: { not: null; lte: Date };
            effectiveAt: { lte: Date };
            OR: [{ retiredAt: null }, { retiredAt: { gt: Date } }];
          };
          orderBy: Array<Record<string, 'desc'>>;
          select: { id: true };
        },
      ]
    >;
    expect(findFirstCalls[0]?.[0]).toEqual({
      where: {
        kind: LegalDocumentKind.TERMS_OF_SERVICE,
        publishedAt: { not: null, lte: acceptedAt },
        effectiveAt: { lte: acceptedAt },
        OR: [{ retiredAt: null }, { retiredAt: { gt: acceptedAt } }],
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
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
        findFirst: vi.fn((args: unknown) => Promise.resolve({ id: activeIds[resolveKind(args)] })),
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
