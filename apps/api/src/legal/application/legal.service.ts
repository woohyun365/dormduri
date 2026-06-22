import { Injectable } from '@nestjs/common';
import type {
  ActiveLegalDocumentsBundleResponse,
  LegalDocumentKind,
  LegalDocumentResponse,
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
}
