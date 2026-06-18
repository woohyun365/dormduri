export const BOOKMARK_SEARCH_METADATA_READER_PORT = Symbol('BOOKMARK_SEARCH_METADATA_READER_PORT');

export interface BookmarkSearchMetadata {
  readonly bookmarkedAt: Date;
}

export interface BookmarkSearchMetadataReaderPort {
  getActiveBookmarkMetadata(input: {
    viewerUserId: string;
    seasonId: string;
    targetParticipantIds: readonly string[];
  }): Promise<ReadonlyMap<string, BookmarkSearchMetadata>>;
}
