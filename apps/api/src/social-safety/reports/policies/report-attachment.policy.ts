export const REPORT_ATTACHMENT_POLICY_EMPTY = 'NO_ATTACHMENTS' as const;
export const REPORT_ATTACHMENT_POLICY_UNVERIFIED_POINTERS =
  'UNVERIFIED_ATTACHMENT_POINTERS' as const;

export function resolveReportAttachmentPolicy(evidenceAttachmentIds: readonly string[]) {
  return evidenceAttachmentIds.length > 0
    ? REPORT_ATTACHMENT_POLICY_UNVERIFIED_POINTERS
    : REPORT_ATTACHMENT_POLICY_EMPTY;
}
