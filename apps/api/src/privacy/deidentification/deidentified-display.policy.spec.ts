import { describe, expect, it } from 'vitest';
import {
  DEIDENTIFIED_USER_DISPLAY_NAME,
  PROFILE_UNAVAILABLE_DISPLAY_NAME,
  resolveProfileDisplayName,
  resolveProfileTombstoneDisplayName,
  resolvePublicCounterpartNickname,
} from './deidentified-display.policy.js';

describe('deidentified-display-owner', () => {
  it('deleted/deidentified 사용자는 nickname fallback보다 탈퇴 사용자 label을 우선한다', () => {
    expect(
      resolveProfileDisplayName({
        deletedAt: new Date('2026-02-10T03:00:00.000Z'),
        displayName: '홍길동',
      }),
    ).toBe(DEIDENTIFIED_USER_DISPLAY_NAME);

    expect(
      resolvePublicCounterpartNickname({
        deletedAt: new Date('2026-02-10T03:00:00.000Z'),
        nicknameSnapshot: '홍길동',
      }),
    ).toBe(DEIDENTIFIED_USER_DISPLAY_NAME);
  });

  it('profile missing은 deleted/deidentified와 구분해 unavailable label을 사용한다', () => {
    expect(resolveProfileDisplayName({ displayName: null })).toBe(PROFILE_UNAVAILABLE_DISPLAY_NAME);
    expect(resolvePublicCounterpartNickname({ nicknameSnapshot: null })).toBe(
      PROFILE_UNAVAILABLE_DISPLAY_NAME,
    );
  });

  it('tombstone displayName은 caller가 확정한 deidentified label을 그대로 사용한다', () => {
    expect(
      resolveProfileTombstoneDisplayName({
        reason: 'TARGET_NO_LONGER_DISCOVERABLE',
        displayName: DEIDENTIFIED_USER_DISPLAY_NAME,
      }),
    ).toBe(DEIDENTIFIED_USER_DISPLAY_NAME);
  });
});
