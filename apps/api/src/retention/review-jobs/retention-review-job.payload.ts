interface ChatIdentityLinkReviewPayloadInput {
  archiveJobId: string;
  retainedIdentityId?: string | null;
  userId?: string | null;
}

export function buildChatIdentityLinkReviewPayload(input: ChatIdentityLinkReviewPayloadInput) {
  return {
    schemaVersion: 1,
    source: 'THREAD_RETENTION',
    archiveJobId: input.archiveJobId,
    retainedIdentityId: input.retainedIdentityId ?? undefined,
    userId: input.userId ?? undefined,
  };
}
