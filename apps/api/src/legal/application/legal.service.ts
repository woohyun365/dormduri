import { Injectable } from '@nestjs/common';
import type {
  ActiveLegalDocumentsBundleResponse,
  LegalDocumentKind,
  LegalDocumentPageResponse,
  LegalDocumentResponse,
  LegalRevisionNoticesResponse,
  LegalVersionComparison,
} from '@repo/shared/legal';
import { LegalDocumentQuery } from '../queries/legal-document.query.js';

@Injectable()
export class LegalService {
  constructor(private readonly legalDocumentQuery: LegalDocumentQuery) {}

  getActiveDocument(kind: LegalDocumentKind): Promise<LegalDocumentResponse> {
    return this.legalDocumentQuery.getActive(kind);
  }

  getActiveBundle(): Promise<ActiveLegalDocumentsBundleResponse> {
    return this.legalDocumentQuery.getActiveBundle();
  }

  getDocumentPage(kind: LegalDocumentKind, version?: unknown): Promise<LegalDocumentPageResponse> {
    return this.legalDocumentQuery.getPage(kind, version);
  }

  getVersionComparison(
    kind: LegalDocumentKind,
    versionKey: string,
  ): Promise<LegalVersionComparison> {
    return this.legalDocumentQuery.getComparison(kind, versionKey);
  }

  getRevisionNotices(): Promise<LegalRevisionNoticesResponse> {
    return this.legalDocumentQuery.getRevisionNotices();
  }
}
