export const BLOCK_VISIBILITY_READER_PORT = Symbol('BLOCK_VISIBILITY_READER_PORT');

export interface BlockVisibilityReaderPort {
  getExcludedTargetUserIds(input: {
    viewerUserId: string;
    targetUserIds: readonly string[];
  }): Promise<ReadonlySet<string>>;
}
