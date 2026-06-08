import {
  NOTIFICATION_CAMPAIGN_DEFAULT_CHUNK_SIZE,
  NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE,
  normalizeNotificationCampaignChunkSize,
} from './notification-campaign-bounds.js';

describe('notification campaign bounds', () => {
  it('기본 chunk와 명시 chunk를 bounded 값으로 정규화한다', () => {
    expect(normalizeNotificationCampaignChunkSize()).toBe(NOTIFICATION_CAMPAIGN_DEFAULT_CHUNK_SIZE);
    expect(normalizeNotificationCampaignChunkSize(1)).toBe(1);
    expect(normalizeNotificationCampaignChunkSize(NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE)).toBe(
      NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE,
    );
  });

  it('0/음수/소수/과대 chunk를 거절한다', () => {
    expect(() => normalizeNotificationCampaignChunkSize(0)).toThrow('positive');
    expect(() => normalizeNotificationCampaignChunkSize(-1)).toThrow('positive');
    expect(() => normalizeNotificationCampaignChunkSize(1.5)).toThrow('integer');
    expect(() =>
      normalizeNotificationCampaignChunkSize(NOTIFICATION_CAMPAIGN_MAX_CHUNK_SIZE + 1),
    ).toThrow('<=');
  });
});
