import type { LegalDocumentKind } from '@repo/shared/legal';

/**
 * A `legalDocumentVersion.findMany` mock for unit specs that only need the version in effect of each
 * kind: one initial version per kind, effective long before any test clock.
 */
export function publishedLegalVersionRows(idOf: (kind: LegalDocumentKind) => string) {
  return (args: unknown) => {
    const kinds = (args as { where?: { kind?: { in?: unknown } } } | null)?.where?.kind?.in;
    if (!Array.isArray(kinds)) {
      throw new Error('legal document findMany where.kind.in is required');
    }
    return Promise.resolve(
      (kinds as LegalDocumentKind[]).map((kind) => ({
        id: idOf(kind),
        kind,
        version: idOf(kind),
        title: `${kind} 문서`,
        summaryItems: [],
        sections: [{ type: 'paragraph', text: '본문' }],
        changeSummary: '변경 요약',
        noticeClass: 'INITIAL',
        consentRequired: false,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        appliesUntil: null,
        publishedAt: new Date('2025-12-31T00:00:00.000Z'),
        withdrawnAt: null,
      })),
    );
  };
}
