export const NOTIFICATION_CAMPAIGN_DEFAULT_CHUNK_SIZE = 100;
export const NOTIFICATION_CAMPAIGN_MIN_CHUNK_SIZE = 1;
export const NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE = 500;

export function normalizeNotificationCampaignChunkSize(chunkSize?: number): number {
  if (chunkSize === undefined) {
    return NOTIFICATION_CAMPAIGN_DEFAULT_CHUNK_SIZE;
  }

  if (!Number.isInteger(chunkSize)) {
    throw new Error('[notification-campaign] chunkSize must be an integer');
  }
  if (chunkSize < NOTIFICATION_CAMPAIGN_MIN_CHUNK_SIZE) {
    throw new Error('[notification-campaign] chunkSize must be positive');
  }
  if (chunkSize > NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE) {
    throw new Error(
      `[notification-campaign] chunkSize must be <= ${NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE}`,
    );
  }

  return chunkSize;
}
