import type {
  LandingPolicyCopy,
  LandingPolicyCopyId,
  LandingSeasonState,
} from './landing-content.types';

export const LANDING_REQUIRED_POLICY_COPY_IDS = [
  'service_independent_notice',
  'school_system_not_connected',
  'room_selection_not_guaranteed',
  'lifestyle_survey_disclaimer',
  'profile_privacy_warning',
  'season_capability_boundary',
  'faq_is_not_support_ticket',
] as const satisfies readonly LandingPolicyCopyId[];

export const LANDING_SEASON_STATE_LABELS = {
  OFF_SEASON: '비시즌',
  SEASON_OPEN: '시즌 오픈',
  SEASON_MATCHING: '시즌 매칭',
  SEASON_POST_MATCH: '시즌 마감 정리 기간',
} as const satisfies Record<LandingSeasonState, string>;

export const LANDING_POLICY_COPY = [
  {
    id: 'service_independent_notice',
    copy: 'KNU 룸메는 학교 공식 서비스가 아닌 독립 운영 서비스입니다.',
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '면책 고지 시점',
      reason: '서비스 진입 화면에서 비공식 서비스 고지를 유지해야 한다.',
    },
    requiredSurface: ['hero', 'footer', 'trust'],
    testAnchor: '독립 운영 서비스',
  },
  {
    id: 'school_system_not_connected',
    copy: '서비스는 학교 시스템과 직접 연동하지 않으며, 사용자가 입력한 정보로 룸메이트 탐색을 돕습니다.',
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '서비스 책임 범위',
      reason: '학교 시스템 일정과 권한을 보장하지 않는다는 boundary를 노출해야 한다.',
    },
    requiredSurface: ['hero', 'trust'],
    testAnchor: '학교 시스템과 직접 연동하지 않으며',
  },
  {
    id: 'room_selection_not_guaranteed',
    copy: '룸메이트 매칭은 호실 선택이나 기숙사 배정 성공을 보장하지 않습니다.',
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '면책 범위',
      reason: '호실 선택은 학교 시스템 영역이며 서비스가 성공을 보장하지 않는다.',
    },
    requiredSurface: ['hero', 'faq', 'trust'],
    testAnchor: '호실 선택이나 기숙사 배정 성공을 보장하지 않습니다',
  },
  {
    id: 'lifestyle_survey_disclaimer',
    copy: '생활패턴 설문은 룸메이트 호환성 참고용이며 학교 기숙사 규정 판단이 아닙니다.',
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '면책 범위',
      reason: '생활패턴 설문은 학교 규정상 허용행위를 뜻하지 않는다.',
    },
    requiredSurface: ['faq', 'trust'],
    testAnchor: '학교 기숙사 규정 판단이 아닙니다',
  },
  {
    id: 'profile_privacy_warning',
    copy: '프로필과 채팅에는 연락처, SNS, 건강, 장애 여부 등 개인정보나 민감정보 입력을 권장하지 않습니다.',
    source: {
      path: 'docs/04_policy/official/data-retention.md',
      section: '채팅 데이터 분리 보관',
      reason:
        '사용자 입력 본문에는 개인정보와 민감정보가 포함될 수 있으므로 공개 입력 surface에서 주의를 제공한다.',
    },
    requiredSurface: ['faq', 'footer', 'support'],
    testAnchor: '개인정보나 민감정보 입력을 권장하지 않습니다',
  },
  {
    id: 'season_capability_boundary',
    copy: '시즌 기능은 비시즌, 시즌 오픈, 시즌 매칭, 시즌 마감 정리 기간에 따라 열리고 닫힙니다.',
    source: {
      path: 'docs/04_policy/official/season-lifecycle.md',
      section: '시즌 상태 모델',
      reason: 'Landing copy는 4-state 시즌 모델을 기준으로 기능 on/off를 설명해야 한다.',
    },
    requiredSurface: ['season', 'faq'],
    testAnchor: '시즌 마감 정리 기간',
  },
  {
    id: 'faq_is_not_support_ticket',
    copy: 'FAQ는 공개 도움말이며 개인 문의, 신고, 이의신청 결과를 대체하지 않습니다.',
    source: {
      path: 'docs/04_policy/official/support-communication.md',
      section: 'FAQ policy',
      reason: 'FAQ는 support ticket을 대체하지 않고, 개인 사건 결과를 포함하지 않는다.',
    },
    requiredSurface: ['faq', 'support'],
    testAnchor: '개인 문의, 신고, 이의신청 결과를 대체하지 않습니다',
  },
] as const satisfies readonly LandingPolicyCopy[];
