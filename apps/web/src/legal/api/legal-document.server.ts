import { type LegalDocumentKind, legalDocumentKindSchema } from '@repo/shared/legal';
import { getWebEnv } from '@/config/env';
import { LEGAL_FALLBACK_DOCUMENTS } from '../content/legal-fallback-documents';
import { toLegalDocumentViewModel } from './legal-document.mapper';
import { fetchLegalDocumentFromUrl } from './legal-document.api';
import type { LegalDocumentLoadResult } from '../types/legal-document.types';

function buildApiLegalDocumentUrl(kind: LegalDocumentKind): string {
  const baseUrl = new URL(getWebEnv().apiUpstreamUrl);
  const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname.replace(/\/+$/, '');
  const path = `${basePath}/api/legal/documents/${encodeURIComponent(kind)}/active`;
  return new URL(path, baseUrl.origin).toString();
}

function readFallbackDocument(kind: LegalDocumentKind) {
  return LEGAL_FALLBACK_DOCUMENTS[kind];
}

export async function getLegalDocumentPageData(
  kind: LegalDocumentKind,
  options: { fetcher?: typeof fetch } = {},
): Promise<LegalDocumentLoadResult> {
  const parsedKind = legalDocumentKindSchema.parse(kind);

  try {
    const document = await fetchLegalDocumentFromUrl(buildApiLegalDocumentUrl(parsedKind), options);
    return {
      status: 'available',
      source: 'api',
      document: toLegalDocumentViewModel(document),
    };
  } catch {
    const fallbackDocument = readFallbackDocument(parsedKind);
    if (!fallbackDocument) {
      return { status: 'unavailable', kind: parsedKind };
    }

    return {
      status: 'available',
      source: 'fallback',
      document: toLegalDocumentViewModel(fallbackDocument),
    };
  }
}
