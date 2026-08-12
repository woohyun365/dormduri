export const REALTIME_DISPATCHER_CONFIG_PORT = Symbol('REALTIME_DISPATCHER_CONFIG_PORT');
export const REALTIME_DISPATCH_METRICS_PORT = Symbol('REALTIME_DISPATCH_METRICS_PORT');
export const REALTIME_USER_ROOM_PUBLISHER_PORT = Symbol('REALTIME_USER_ROOM_PUBLISHER_PORT');

export type RealtimeDispatcherName = 'chat' | 'notification';
export type RealtimeDispatcherSkippedReason = 'PUBLISHER_UNBOUND';

export interface RealtimeDispatcherConfigPort {
  dispatcherEnabled: boolean;
  dispatcherIntervalMs: number;
  dispatcherBatchSize: number;
  dispatcherClaimLeaseMs: number;
  dispatcherRetryBaseMs: number;
  dispatcherRetryMaxMs: number;
}

export interface RealtimeDispatchMetricsPort {
  recordPublishFailure(dispatcher?: RealtimeDispatcherName): void;

  recordDispatcherSkipped(input: {
    dispatcher: RealtimeDispatcherName;
    skippedReason: RealtimeDispatcherSkippedReason;
    now: Date;
  }): void;

  recordDispatcherBatch(input: {
    dispatcher: RealtimeDispatcherName;
    claimedCount: number;
    publishedCount: number;
    failedCount: number;
    oldestOccurredAt: Date | null;
    now: Date;
  }): void;

  recordOutboxPrune(input: { deletedCount: number; now: Date }): void;

  recordOutboxPruneFailure(input: { now: Date }): void;
}

export interface RealtimeUserRoomPublisherPort {
  isBound(): boolean;

  publishToUserRoom(input: { userId: string; eventName: string; payload: unknown }): void;
}
