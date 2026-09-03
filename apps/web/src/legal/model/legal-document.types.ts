import type {
  LegalDocumentKind,
  LegalDocumentResponse,
  LegalDocumentSection,
} from '@repo/shared/legal';

export type LegalDocumentSource = 'api' | 'fallback';

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

export type LegalDocumentLoadResult =
  | {
      status: 'available';
      source: LegalDocumentSource;
      document: LegalDocumentViewModel;
    }
  | {
      status: 'unavailable';
      kind: LegalDocumentKind;
    };
