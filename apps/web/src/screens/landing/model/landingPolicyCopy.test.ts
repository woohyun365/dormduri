import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LANDING_POLICY_COPY,
  LANDING_REQUIRED_POLICY_COPY_IDS,
  LANDING_SURFACE_SECTION_IDS,
  getLandingPolicyCopy,
} from './landingPolicyCopy';

const repoRoot = path.resolve(process.cwd(), '../..');

describe('landing policy copy contract', () => {
  it('backs every required notice with exactly one copy and a tracked policy source', () => {
    for (const id of LANDING_REQUIRED_POLICY_COPY_IDS) {
      expect(LANDING_POLICY_COPY.filter((item) => item.id === id)).toHaveLength(1);
      const { source } = getLandingPolicyCopy(id);
      expect(source.path).toMatch(/^docs\/policies\/.+\.md$/);
      expect(existsSync(path.join(repoRoot, source.path))).toBe(true);
      expect(source.section.length).toBeGreaterThan(0);
    }
  });

  // The four disclaimers are legal boundary sentences: their wording changes only with expert review.
  // A service rename changes only the subject name, with the Owner checking the before/after pair.
  it('keeps the four disclaimer sentences word for word', () => {
    expect(getLandingPolicyCopy('service_independent_notice').copy).toBe(
      '돔두리는 학교 공식 서비스가 아닙니다.',
    );
    expect(getLandingPolicyCopy('school_system_not_connected').copy).toBe(
      '학교 기숙사 시스템과 연동되지 않으며, 사용자에게 룸메이트 탐색을 돕습니다.',
    );
    expect(getLandingPolicyCopy('room_selection_not_guaranteed').copy).toBe(
      '기숙사 배정·호실 선택을 보장하지 않습니다.',
    );
    expect(getLandingPolicyCopy('lifestyle_survey_disclaimer').copy).toBe(
      '룸메 적합도 계산에 사용되며, 학교 기숙사 규정 판단이 아닙니다.',
    );
  });

  it('gives every notice a test anchor from its own copy and a surface the page has', () => {
    for (const item of LANDING_POLICY_COPY) {
      expect(item.copy).toContain(item.testAnchor);
      expect(item.requiredSurface.length).toBeGreaterThan(0);
      for (const surface of item.requiredSurface) {
        expect(LANDING_SURFACE_SECTION_IDS[surface]).toBeTruthy();
      }
    }
  });

  it('puts the not-official notice on the first screen (service-boundary.md 면책 고지 시점)', () => {
    expect(getLandingPolicyCopy('service_independent_notice').requiredSurface).toContain('hero');
  });
});
