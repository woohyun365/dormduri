export const CHAT_THREAD_SEARCH_METADATA_READER_PORT = Symbol(
  'CHAT_THREAD_SEARCH_METADATA_READER_PORT',
);

export type ChatThreadSearchMetadataKind = 'DIRECT' | 'MATCHED';
export type ChatThreadSearchMetadataStatus = 'OPEN';

export interface ChatThreadSearchMetadata {
  readonly threadId: string;
  readonly targetParticipantId: string;
  readonly threadKind: ChatThreadSearchMetadataKind;
  readonly status: ChatThreadSearchMetadataStatus;
  readonly lastMessageAt: Date | null;
}

export interface ChatThreadSearchMetadataReaderPort {
  getActiveThreadMetadata(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
  }): Promise<ReadonlyMap<string, ChatThreadSearchMetadata>>;
}
