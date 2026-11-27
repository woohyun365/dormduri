import type { LegalRevisionNotice } from '@repo/shared/legal';
import type { PublicLegalDocumentKind } from '../../ui/model/legalAddress';

// The revision line's documents (D-LU17): the public reading API names every kind with a version
// announced and not yet in force; the Landing shows only the documents with a public address, the
// privacy policy before the terms, one line each. The collection-use consent and the age notice have
// no public page, so they have no line.
export type LandingRevisionLine = {
  kind: PublicLegalDocumentKind;
  versionKey: string;
  appliesFrom: string;
};

const lineOrder = [
  'PRIVACY_POLICY',
  'TERMS_OF_SERVICE',
] as const satisfies readonly PublicLegalDocumentKind[];

export function toLandingRevisionLines(
  notices: readonly LegalRevisionNotice[],
): LandingRevisionLine[] {
  return lineOrder.flatMap((kind) => {
    // Two announced versions of one document: the line names the one that applies first.
    const first = notices
      .filter((notice) => notice.kind === kind)
      .reduce<LegalRevisionNotice | null>(
        (earliest, notice) =>
          earliest === null || notice.appliesFrom < earliest.appliesFrom ? notice : earliest,
        null,
      );
    return first ? [{ kind, versionKey: first.versionKey, appliesFrom: first.appliesFrom }] : [];
  });
}
