// Types for legal-seed-source.mjs. The values are checked against the shared legal contract in
// legal-seed-documents.ts, so they stay unknown here.
export declare const LEGAL_SEED_SOURCE: {
  readonly referenceRows: readonly unknown[];
  readonly versionRows: readonly unknown[];
  readonly contentFiles: Readonly<Record<string, unknown>>;
  readonly firstRevisionDrafts: Readonly<Record<'PRIVACY_POLICY' | 'TERMS_OF_SERVICE', unknown>>;
};
