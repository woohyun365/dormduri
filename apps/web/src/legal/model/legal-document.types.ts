import type {
  LegalDocumentKind,
  LegalDocumentResponse,
  LegalDocumentSection,
} from '@repo/shared/legal';

/** Where a shown document came from: the API's published version, or this Web's last success of the request. */
export type LegalDocumentSource =
  { readonly kind: 'published' } | { readonly kind: 'last-success'; readonly checkedAt: string };

export type LegalDocumentHeadingSection = Extract<LegalDocumentSection, { type: 'heading' }> & {
  id: string;
};

export type LegalDocumentViewSection =
  LegalDocumentHeadingSection | Exclude<LegalDocumentSection, { type: 'heading' }>;

export type LegalDocumentTocItem = {
  id: string;
  level: 2 | 3 | 4;
  text: string;
};

export type LegalDocumentViewModel = Omit<LegalDocumentResponse, 'sections'> & {
  kind: LegalDocumentKind;
  sections: LegalDocumentViewSection[];
  tocItems: LegalDocumentTocItem[];
  versionLabel: string;
  effectiveDateLabel: string;
  lastModifiedDateLabel: string;
};

/**
 * A public reading load: the API's published version (a database or an in-memory answer), the last response
 * this Web saved for the same request, a version address the API does not have, or nothing to show.
 */
export type LegalLoadResult<T> =
  | { readonly status: 'published'; readonly data: T }
  | { readonly status: 'last-success'; readonly data: T; readonly checkedAt: string }
  | { readonly status: 'version-not-found' }
  | { readonly status: 'unavailable' };
