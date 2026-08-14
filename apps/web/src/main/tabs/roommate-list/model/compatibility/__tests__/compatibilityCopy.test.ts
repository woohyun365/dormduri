import { describe, expect, it } from 'vitest';
import {
  COMPATIBILITY_PRIVACY_NOTE,
  compatibilityAxisLabel,
  compatibilityBucketLabel,
  compatibilityScoreLabel,
} from '../compatibilityCopy';
import { findCompatibilityPrivacyViolations } from '../compatibilityPrivacy.policy';

describe('compatibilityCopy', () => {
  it('allowlist axis와 bucket을 안전한 한글 copy로 변환한다', () => {
    expect(compatibilityAxisLabel('SMOKING')).toBe('흡연');
    expect(compatibilityAxisLabel('PHONE')).toBe('실내 통화');
    expect(compatibilityAxisLabel('EARPHONE')).toBe('영상 시청 시 소리');
    expect(compatibilityAxisLabel('RELATIONSHIP')).toBe('친밀도');
    expect(compatibilityBucketLabel('HIGH')).toBe('잘 맞음');
    expect(compatibilityBucketLabel('UNKNOWN')).toBe('정보 없음');
    expect(compatibilityScoreLabel(80)).toBe('80점');
    expect(compatibilityScoreLabel(null)).toBe('점수 없음');
  });

  it('privacy note는 raw/private key를 포함하지 않는다', () => {
    const copy = COMPATIBILITY_PRIVACY_NOTE;

    expect(copy).toBe('상세 적합도는 공개 가능한 생활패턴 축만 사용해요.');
    expect(findCompatibilityPrivacyViolations(copy)).toEqual([]);
  });

  it('privacy helper는 hidden/raw debug key를 감지한다', () => {
    expect(findCompatibilityPrivacyViolations('viewerValue leaked')).toEqual(['viewerValue']);
    expect(findCompatibilityPrivacyViolations('safe copy')).toEqual([]);
  });
});
