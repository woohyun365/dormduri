import type { LegalDocumentKind, LegalNoticeClass, LegalVersionKey } from './contract.js';

/** JSON with object keys sorted at every depth, so a JSONB round trip keeps the same text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface LegalDigestContent {
  readonly kind: LegalDocumentKind;
  readonly title: string;
  readonly summaryItems: readonly string[];
  readonly sections: readonly unknown[];
  readonly changeSummary: string;
  readonly effectiveDate: LegalVersionKey;
  readonly appliesUntil: LegalVersionKey | null;
  readonly noticeClass: LegalNoticeClass;
  readonly consentRequired: boolean;
}

/**
 * The text whose sha256 is a version's content digest: the content in a fixed order. Approval compares
 * the request digest with the draft digest, so both sides build it from parsed (default-filled) content.
 * Only a historical record carries its applies-until date. Hashing stays with the caller (no runtime
 * globals in this package).
 */
export function legalContentDigestInput(content: LegalDigestContent): string {
  return canonicalJson([
    content.kind,
    content.title,
    content.summaryItems,
    content.sections,
    content.changeSummary,
    content.effectiveDate,
    content.noticeClass === 'HISTORICAL' ? content.appliesUntil : null,
    content.noticeClass,
    content.consentRequired,
  ]);
}
