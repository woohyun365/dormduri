import { Injectable } from '@nestjs/common';
import {
  LegalDocumentKind,
  type LegalDocumentKind as SharedLegalDocumentKind,
} from '@repo/shared/legal';
import type { ActiveLegalDocumentsBundleResponse, LegalDocumentResponse } from '@repo/shared/legal';
import { legalErrors } from '../errors/legal.errors.js';
import {
  REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS,
  toActiveLegalDocumentsBundleResponse,
  toLegalDocumentResponse,
} from '../presenters/legal-document.presenter.js';
import {
  LegalDocumentRepository,
  type LegalDocumentVersionRecord,
} from '../repositories/legal-document.repository.js';

@Injectable()
export class LegalDocumentQuery {
  constructor(private readonly repository: LegalDocumentRepository) {}

  async getActive(kind: SharedLegalDocumentKind): Promise<LegalDocumentResponse> {
    const now = await this.repository.getDatabaseNow();
    const record = await this.repository.findActiveByKind(kind, now);

    if (!record) {
      throw legalErrors.documentNotFound();
    }

    return toLegalDocumentResponse(record);
  }

  async getActiveBundle(): Promise<ActiveLegalDocumentsBundleResponse> {
    const now = await this.repository.getDatabaseNow();
    const records = await Promise.all(
      REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS.map(async (kind) => [
        kind,
        await this.repository.findActiveByKind(kind, now),
      ]),
    );
    const recordsByKind = new Map<SharedLegalDocumentKind, LegalDocumentVersionRecord>(
      records.filter((entry): entry is [SharedLegalDocumentKind, LegalDocumentVersionRecord] =>
        Boolean(entry[1]),
      ),
    );

    const termsOfService = recordsByKind.get(LegalDocumentKind.TERMS_OF_SERVICE);
    const privacyPolicy = recordsByKind.get(LegalDocumentKind.PRIVACY_POLICY);
    const personalDataCollectionUseConsent = recordsByKind.get(
      LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
    );
    const age14OrAboveNotice = recordsByKind.get(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE);

    if (
      !termsOfService ||
      !privacyPolicy ||
      !personalDataCollectionUseConsent ||
      !age14OrAboveNotice
    ) {
      throw legalErrors.activeBundleIncomplete();
    }

    return toActiveLegalDocumentsBundleResponse({
      termsOfService,
      privacyPolicy,
      personalDataCollectionUseConsent,
      age14OrAboveNotice,
    });
  }
}
