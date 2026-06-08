export const NOTIFICATION_REALTIME_PUBLISHER = Symbol('NOTIFICATION_REALTIME_PUBLISHER');

export type NotificationRealtimePublisherPort = {
  isBound(): boolean;
  publishNotificationCreated(input: { recipientUserId: string; event: unknown }): void;
};
