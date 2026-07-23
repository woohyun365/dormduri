import { describe, expect, it } from 'vitest';
import {
  LANDING_POLICY_COPY,
  LANDING_REQUIRED_POLICY_COPY_IDS,
  LANDING_SEASON_STATE_LABELS,
} from '../content/landing-policy-copy';
import {
  LANDING_POLICY_LINKED_CONTENT_GROUPS,
  landingMatchingCapabilitySteps,
  landingSeasonJourneyItems,
  landingSupportCopy,
} from '../content/landing-copy';
import { landingHeroProfilePreview } from '../content/landing-profile-preview.examples';
import type { LandingPolicyCopyId } from '../content/landing-content.types';

const FORBIDDEN_PUBLIC_CONTENT_PATTERNS = [
  /<\/?[a-z][\s\S]*>/i,
  /RetainedVaultObject/i,
  /RetentionAccessLog/i,
  /emailHash/i,
  /originalUserId/i,
  /passwordHash/i,
  /accessToken/i,
  /refreshToken/i,
  /admin note/i,
  /operator note/i,
];

function expectPublicPlainText(value: string) {
  expect(value.trim().length).toBeGreaterThan(0);

  for (const pattern of FORBIDDEN_PUBLIC_CONTENT_PATTERNS) {
    expect(value).not.toMatch(pattern);
  }
}

describe('landing content policy contract', () => {
  it('required policy copy ids are all backed by tracked copy and official policy sources', () => {
    const policyCopyById = new Map<LandingPolicyCopyId, (typeof LANDING_POLICY_COPY)[number]>();

    for (const copy of LANDING_POLICY_COPY) {
      expect(policyCopyById.has(copy.id)).toBe(false);
      policyCopyById.set(copy.id, copy);
      expectPublicPlainText(copy.copy);
      expect(copy.copy).toContain(copy.testAnchor);
      expect(copy.source.path).toMatch(/^docs\/04_policy\/official\/.+\.md$/);
      expect(copy.source.section.trim()).not.toBe('');
      expect(copy.source.reason.trim()).not.toBe('');
      expect(copy.requiredSurface.length).toBeGreaterThan(0);
    }

    for (const requiredId of LANDING_REQUIRED_POLICY_COPY_IDS) {
      expect(policyCopyById.has(requiredId)).toBe(true);
    }
  });

  it('tracks the four-state season model used by official policy', () => {
    expect(Object.keys(LANDING_SEASON_STATE_LABELS)).toEqual([
      'OFF_SEASON',
      'SEASON_OPEN',
      'SEASON_MATCHING',
      'SEASON_POST_MATCH',
    ]);

    expect(Object.values(LANDING_SEASON_STATE_LABELS)).toEqual([
      '비시즌',
      '시즌 오픈',
      '시즌 매칭',
      '시즌 마감 정리 기간',
    ]);

    const seasonCopy = LANDING_POLICY_COPY.find((copy) => copy.id === 'season_capability_boundary');
    expect(seasonCopy?.copy).toContain(LANDING_SEASON_STATE_LABELS.SEASON_POST_MATCH);
  });

  it('keeps support boundary ids and copy user-domain oriented instead of FAQ or ticket jargon', () => {
    const serializedLandingContent = JSON.stringify({
      policy: LANDING_POLICY_COPY,
      support: landingSupportCopy,
    });

    expect(serializedLandingContent).toContain('support_channel_boundary');
    expect(serializedLandingContent).not.toMatch(/support\s+ticket|faq_is_not_support_ticket/i);
  });

  it('keeps section content policy links pointed at tracked policy ids', () => {
    const policyCopyIds = new Set<LandingPolicyCopyId>(LANDING_POLICY_COPY.map((copy) => copy.id));

    for (const group of LANDING_POLICY_LINKED_CONTENT_GROUPS) {
      for (const item of group) {
        const linkedIds = 'policyCopyIds' in item ? item.policyCopyIds : [];

        for (const policyCopyId of linkedIds) {
          expect(policyCopyIds.has(policyCopyId)).toBe(true);
        }
      }
    }
  });

  it('keeps the season journey and core matching flow aligned to the policy model', () => {
    expect(landingSeasonJourneyItems.map((item) => item.state)).toEqual([
      'OFF_SEASON',
      'SEASON_OPEN',
      'SEASON_MATCHING',
      'SEASON_POST_MATCH',
    ]);

    expect(landingMatchingCapabilitySteps.map((step) => step.id)).toEqual([
      'season-registration',
      'candidate-chat',
      'match-request',
      'matched-chat',
    ]);

    expect(landingMatchingCapabilitySteps[0]?.availabilityLabel).toBe('시즌 오픈·매칭');
    expect(landingMatchingCapabilitySteps[1]?.availabilityLabel).toBe('시즌 등록 후');
    expect(landingMatchingCapabilitySteps[2]?.availabilityLabel).toBe('시즌 매칭');
    expect(landingMatchingCapabilitySteps[3]?.availabilityLabel).toBe('매칭 확정 후');
  });

  it('marks profile preview examples as examples instead of real users or guaranteed results', () => {
    const profile = landingHeroProfilePreview;

    expect(profile.displayDormitoryLabel).toMatch(/^(다온관|새롬관|이룸관) \((남|여)\)$/);
    expect(profile.displayDormitoryLabel).not.toContain('예시');
    expect(profile.profileSummary.intro).not.toContain('예시');
    expect('message' in profile).toBe(false);
    expect(profile.profileSummary.smokingBehavior).not.toBeNull();
    expect(profile.profileSummary.sleepHabit).not.toBeNull();
    expect(profile.profileSummary.relationshipStyle).not.toBeNull();
    expect(profile.matchScore).toBeGreaterThan(0);
    expect(profile.matchScore).toBeLessThanOrEqual(100);
    expect(profile).not.toHaveProperty('actions');
    expect(profile).not.toHaveProperty('exposure');
  });
});
