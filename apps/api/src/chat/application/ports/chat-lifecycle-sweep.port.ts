export const CHAT_LIFECYCLE_SWEEP_PORT = Symbol('CHAT_LIFECYCLE_SWEEP_PORT');

export interface ChatLifecycleSweepResult {
  scannedCount: number;
  updatedCount: number;
}

export interface ChatLifecycleSweepPort {
  sweepThreadLifecycle(now: Date): Promise<ChatLifecycleSweepResult>;
}
