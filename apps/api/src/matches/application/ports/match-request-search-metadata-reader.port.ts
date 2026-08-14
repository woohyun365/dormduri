export const MATCH_REQUEST_SEARCH_METADATA_READER_PORT = Symbol(
  'MATCH_REQUEST_SEARCH_METADATA_READER_PORT',
);

export type MatchRequestSearchMetadataDirection = 'SENT' | 'RECEIVED';

export interface MatchRequestSearchMetadata {
  readonly requestId: string;
  readonly direction: MatchRequestSearchMetadataDirection;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface MatchRequestDirectionLimitMetadata {
  readonly targetParticipantId: string;
  readonly directionCount: number;
}

export interface MatchRequestSearchMetadataReaderPort {
  getLivePendingRequestMetadata(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
    now: Date;
  }): Promise<ReadonlyMap<string, MatchRequestSearchMetadata>>;

  getDirectionLimitReachedMetadata(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
  }): Promise<ReadonlyMap<string, MatchRequestDirectionLimitMetadata>>;

  isPendingSentLimitReached(input: {
    seasonId: string;
    viewerParticipantId: string;
    now: Date;
  }): Promise<boolean>;

  getDirectionCooldownActiveTargetIds(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
    now: Date;
  }): Promise<ReadonlySet<string>>;
}
