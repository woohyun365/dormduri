import { HttpException, Injectable } from '@nestjs/common';
import {
  LegalDocumentKind,
  compareLegalSections,
  legalDocumentResponseSchema,
  legalVersionKeySchema,
  type ActiveLegalDocumentsBundleResponse,
  type LegalDocumentKind as SharedLegalDocumentKind,
  type LegalDocumentPageResponse,
  type LegalDocumentResponse,
  type LegalRevisionNoticesResponse,
  type LegalVersionComparison,
} from '@repo/shared/legal';
import {
  currentLegalVersionOf,
  legalTimelineOf,
  type LegalVersionEntry,
} from '../domain/legal-version.js';
import { legalErrors } from '../errors/legal.errors.js';
import type { LegalReadEndpoint } from '../observability/legal-metric.definitions.js';
import {
  REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS,
  toActiveLegalDocumentsBundleResponse,
  toLegalDocumentPageResponse,
  toLegalDocumentResponse,
  toLegalRevisionNoticesResponse,
  toLegalVersionComparison,
} from '../presenters/legal-document.presenter.js';
import {
  LegalPublishedVersionReader,
  type LegalPublishedRead,
} from './legal-published-version.reader.js';

// The API has no direct zod dependency; the shared response schema owns the sections shape.
const sectionsSchema = legalDocumentResponseSchema.shape.sections;

function isNotFound(error: unknown): boolean {
  return error instanceof HttpException && error.getStatus() === 404;
}

/** A requested version key, or null when it is not a real `YYYY-MM-DD` date (answered as an unknown version). */
function parseVersionKey(value: unknown): string | null {
  const parsed = legalVersionKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

@Injectable()
export class LegalDocumentQuery {
  constructor(private readonly reader: LegalPublishedVersionReader) {}

  getActive(kind: SharedLegalDocumentKind): Promise<LegalDocumentResponse> {
    return this.answer([kind], 'active', (read) => {
      const current = currentLegalVersionOf(this.timeline(read, kind));
      if (!current) {
        throw legalErrors.documentNotFound();
      }
      return toLegalDocumentResponse(current);
    });
  }

  getActiveBundle(): Promise<ActiveLegalDocumentsBundleResponse> {
    return this.answer(REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS, 'active-bundle', (read) => {
      const currentOf = (kind: SharedLegalDocumentKind) =>
        currentLegalVersionOf(this.timeline(read, kind));
      const termsOfService = currentOf(LegalDocumentKind.TERMS_OF_SERVICE);
      const privacyPolicy = currentOf(LegalDocumentKind.PRIVACY_POLICY);
      const personalDataCollectionUseConsent = currentOf(
        LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
      );
      const age14OrAboveNotice = currentOf(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE);

      // Signup needs all four; a partial bundle is never returned.
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
    });
  }

  /** The version in effect when `version` is absent, else the version with that effective date. */
  getPage(kind: SharedLegalDocumentKind, version?: unknown): Promise<LegalDocumentPageResponse> {
    return this.answer([kind], 'page', (read) => {
      const timeline = this.timeline(read, kind);
      let viewing: LegalVersionEntry | null;
      if (version === undefined) {
        viewing = currentLegalVersionOf(timeline);
        if (!viewing) {
          throw legalErrors.documentNotFound();
        }
      } else {
        const versionKey = parseVersionKey(version);
        viewing = timeline.find((entry) => entry.effectiveDate === versionKey) ?? null;
        if (!viewing) {
          throw legalErrors.versionNotFound();
        }
      }
      return toLegalDocumentPageResponse({ kind, viewing, timeline });
    });
  }

  /** The article comparison with the version right before it (withdrawn versions are not listed). */
  getComparison(
    kind: SharedLegalDocumentKind,
    versionKey: unknown,
  ): Promise<LegalVersionComparison> {
    return this.answer([kind], 'comparison', (read) => {
      const timeline = this.timeline(read, kind);
      const key = parseVersionKey(versionKey);
      const index = timeline.findIndex((entry) => entry.effectiveDate === key);
      const target = timeline[index];
      if (!target) {
        throw legalErrors.versionNotFound();
      }
      const previous = timeline[index + 1] ?? null;
      return toLegalVersionComparison({
        kind,
        versionKey: target.effectiveDate,
        previousVersionKey: previous?.effectiveDate ?? null,
        articles: compareLegalSections(
          previous ? sectionsSchema.parse(previous.sections) : null,
          sectionsSchema.parse(target.sections),
        ),
      });
    });
  }

  /** Every kind's scheduled version, for the first-screen revision line and later notice screens. */
  getRevisionNotices(): Promise<LegalRevisionNoticesResponse> {
    return this.answer(REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS, 'revision-notices', (read) =>
      toLegalRevisionNoticesResponse(
        REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS.flatMap((kind) =>
          this.timeline(read, kind)
            .filter((entry) => entry.status === 'scheduled')
            .map((entry) => ({ kind, entry })),
        ),
      ),
    );
  }

  private timeline(read: LegalPublishedRead, kind: SharedLegalDocumentKind): LegalVersionEntry[] {
    return legalTimelineOf(read.versionsOf(kind), read.nowOf(kind));
  }

  private async answer<T>(
    kinds: readonly SharedLegalDocumentKind[],
    endpoint: LegalReadEndpoint,
    respond: (read: LegalPublishedRead) => T,
  ): Promise<T> {
    const read = await this.reader.read(kinds, endpoint);
    try {
      const response = respond(read);
      this.reader.record(endpoint, read.source, 'ok');
      return response;
    } catch (error) {
      this.reader.record(endpoint, read.source, isNotFound(error) ? 'not_found' : 'unavailable');
      throw error;
    }
  }
}
