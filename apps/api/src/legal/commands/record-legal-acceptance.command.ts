import {
  LegalAcceptanceAction,
  LegalDocumentKind,
  type SignupLegalAcceptances,
} from '@repo/shared/legal';
import type { Prisma } from '../../generated/prisma/client.js';

export const SIGNUP_LEGAL_ACCEPTANCE_STALE = '[LegalAcceptance] signup legal acceptance stale';

export const SIGNUP_LEGAL_ACCEPTANCE_REQUIREMENTS = [
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
] as const;

type SignupLegalAcceptanceField = (typeof SIGNUP_LEGAL_ACCEPTANCE_REQUIREMENTS)[number]['field'];
type LegalAcceptanceTransactionClient = Pick<
  Prisma.TransactionClient,
  'legalDocumentVersion' | 'legalAcceptanceRecord'
>;

export interface ResolvedSignupLegalAcceptance {
  documentVersionId: string;
  kind: LegalDocumentKind;
  action: LegalAcceptanceAction;
  acceptedAt: Date;
  source: 'SIGNUP';
}

function readRequestedDocumentVersionId(
  legalAcceptances: SignupLegalAcceptances,
  field: SignupLegalAcceptanceField,
): string {
  return legalAcceptances[field];
}

async function findActiveLegalDocumentId(
  tx: LegalAcceptanceTransactionClient,
  kind: LegalDocumentKind,
  now: Date,
): Promise<string | null> {
  const record = await tx.legalDocumentVersion.findFirst({
    where: {
      kind,
      publishedAt: { not: null, lte: now },
      effectiveAt: { lte: now },
      OR: [{ retiredAt: null }, { retiredAt: { gt: now } }],
    },
    orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });

  return record?.id ?? null;
}

export async function resolveSignupLegalAcceptances(
  tx: LegalAcceptanceTransactionClient,
  legalAcceptances: SignupLegalAcceptances,
  acceptedAt: Date,
): Promise<ResolvedSignupLegalAcceptance[]> {
  const resolved: ResolvedSignupLegalAcceptance[] = [];

  for (const requirement of SIGNUP_LEGAL_ACCEPTANCE_REQUIREMENTS) {
    const activeDocumentId = await findActiveLegalDocumentId(tx, requirement.kind, acceptedAt);
    if (!activeDocumentId) {
      throw new Error(SIGNUP_LEGAL_ACCEPTANCE_STALE);
    }

    const requestedDocumentVersionId = readRequestedDocumentVersionId(
      legalAcceptances,
      requirement.field,
    );
    if (requestedDocumentVersionId !== activeDocumentId) {
      throw new Error(SIGNUP_LEGAL_ACCEPTANCE_STALE);
    }

    resolved.push({
      documentVersionId: activeDocumentId,
      kind: requirement.kind,
      action: requirement.action,
      acceptedAt,
      source: 'SIGNUP',
    });
  }

  return resolved;
}

export async function createSignupLegalAcceptanceRecords(
  tx: LegalAcceptanceTransactionClient,
  userId: string,
  acceptances: ResolvedSignupLegalAcceptance[],
): Promise<void> {
  await tx.legalAcceptanceRecord.createMany({
    data: acceptances.map((acceptance) => ({
      userId,
      documentVersionId: acceptance.documentVersionId,
      kind: acceptance.kind,
      action: acceptance.action,
      acceptedAt: acceptance.acceptedAt,
      source: acceptance.source,
    })),
  });
}
