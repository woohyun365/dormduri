import { Injectable } from '@nestjs/common';
import {
  LEGAL_CONSENT_KINDS,
  LegalAcceptanceAction,
  legalPendingConsentsResponseSchema,
  type LegalConsentKind,
  type LegalPendingConsentsResponse,
} from '@repo/shared/legal';
import type { Prisma } from '@repo/database/client';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { isPrismaKnownRequestError } from '../../platform/database/prisma-error.js';
import {
  legalTimelineOf,
  toLegalVersion,
  type LegalVersionEntry,
} from '../domain/legal-version.js';
import { legalErrors } from '../errors/legal.errors.js';
import { toLegalDocumentResponse } from '../presenters/legal-document.presenter.js';
import { findPublishedLegalVersions } from '../repositories/legal-document.repository.js';

type ReconsentClient = Pick<
  Prisma.TransactionClient,
  'legalDocumentVersion' | 'legalAcceptanceRecord'
>;

interface PendingConsent {
  readonly kind: LegalConsentKind;
  /** The version in effect, which covers the change of the version that asked again. */
  readonly current: LegalVersionEntry;
}

/**
 * A kind is pending when its latest version in effect that asks for consent again (R) has no AGREE
 * record from the member on R or a later version. The member then consents to the version in effect,
 * so a later version that does not ask again keeps a member who skipped R pending (legal-basis LB-R11).
 */
async function findPendingConsents(
  client: ReconsentClient,
  userId: string,
  now: Date,
): Promise<PendingConsent[]> {
  const versions = (await findPublishedLegalVersions(client, LEGAL_CONSENT_KINDS, now)).map(
    toLegalVersion,
  );
  const agreed = await client.legalAcceptanceRecord.findMany({
    where: { userId, action: LegalAcceptanceAction.AGREE },
    select: { documentVersionId: true },
  });
  const agreedIds = new Set(agreed.map((record) => record.documentVersionId));

  return LEGAL_CONSENT_KINDS.flatMap((kind): PendingConsent[] => {
    const inEffect = legalTimelineOf(
      versions.filter((version) => version.kind === kind),
      now,
    ).filter((entry) => entry.status !== 'scheduled');
    const asking = inEffect.find((entry) => entry.consentRequired);
    const current = inEffect.find((entry) => entry.status === 'current');
    if (!asking || !current) {
      return [];
    }
    const covered = inEffect.some(
      (entry) => entry.effectiveDate >= asking.effectiveDate && agreedIds.has(entry.id),
    );
    return covered ? [] : [{ kind: kind as LegalConsentKind, current }];
  });
}

function toPendingResponse(pending: readonly PendingConsent[]): LegalPendingConsentsResponse {
  return legalPendingConsentsResponseSchema.parse({
    pending: pending.map(({ kind, current }) => ({
      kind,
      document: toLegalDocumentResponse(current),
    })),
  });
}

/** Reconsent for signed-up members (the screen and login gate belong to the Auth axis). */
@Injectable()
export class LegalReconsentCommand {
  constructor(private readonly prisma: PrismaService) {}

  async getPending(userId: string): Promise<LegalPendingConsentsResponse> {
    const now = await this.prisma.getDatabaseNow();
    return toPendingResponse(await findPendingConsents(this.prisma, userId, now));
  }

  /**
   * Records an AGREE for each named version. Every id must be the version in effect of a kind the
   * member owes, else nothing is written (fail-closed like signup acceptance).
   */
  async record(
    userId: string,
    documentVersionIds: readonly string[],
  ): Promise<LegalPendingConsentsResponse> {
    const now = await this.prisma.getDatabaseNow();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pending = await findPendingConsents(tx, userId, now);
        const requested = new Set(documentVersionIds);
        const accepted = pending.filter(({ current }) => requested.has(current.id));
        if (accepted.length !== requested.size) {
          throw legalErrors.consentStale();
        }
        await tx.legalAcceptanceRecord.createMany({
          data: accepted.map(({ kind, current }) => ({
            userId,
            documentVersionId: current.id,
            kind,
            action: LegalAcceptanceAction.AGREE,
            acceptedAt: now,
            source: 'RECONSENT',
          })),
        });
        return toPendingResponse(pending.filter((entry) => !accepted.includes(entry)));
      });
    } catch (error) {
      // A concurrent reconsent for the same version already recorded it.
      if (isPrismaKnownRequestError(error, 'P2002')) {
        throw legalErrors.consentStale();
      }
      throw error;
    }
  }
}
