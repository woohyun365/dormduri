import type { LandingFallbackFaqItem } from './landing-content.types';

export const LANDING_FALLBACK_FAQ_SOURCE_KIND = 'emergency_fallback';

export const landingFallbackFaqItems = [
  {
    id: 'service-boundary-independent-service',
    question: 'KNU 룸메는 학교 공식 서비스인가요?',
    answer:
      '아니요. KNU 룸메는 학교 공식 서비스가 아닌 독립 운영 서비스입니다. 학교 시스템과 연동하지 않고, 사용자가 입력한 정보로 룸메이트 탐색을 돕습니다.',
    policyCopyIds: ['service_independent_notice', 'school_system_not_connected'],
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '면책 고지 시점',
      reason: '랜딩 진입 시 비공식 서비스와 학교 시스템 미연동 사실을 안내한다.',
    },
    sortOrder: 10,
  },
  {
    id: 'room-selection-not-guaranteed',
    question: '호실 선택이나 기숙사 배정을 보장하나요?',
    answer:
      '보장하지 않습니다. 서비스는 생활패턴과 조건을 비교해 룸메이트 탐색을 돕지만, 실제 호실 선택과 기숙사 배정은 학교 시스템에서 직접 진행됩니다.',
    policyCopyIds: ['room_selection_not_guaranteed', 'school_system_not_connected'],
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '면책 범위',
      reason: '호실 선택 성공은 학교 시스템 영역이며 서비스 책임 범위 밖이다.',
    },
    sortOrder: 20,
  },
  {
    id: 'lifestyle-survey-disclaimer',
    question: '생활패턴 설문은 학교 규정과 관련이 있나요?',
    answer:
      '아닙니다. 생활패턴 설문은 룸메이트 호환성 비교를 위한 참고 자료이며, 학교 기숙사 규정상 허용행위를 뜻하거나 학교의 판단을 대체하지 않습니다.',
    policyCopyIds: ['lifestyle_survey_disclaimer'],
    source: {
      path: 'docs/04_policy/official/service-boundary.md',
      section: '면책 범위',
      reason: '생활패턴 설문은 학교 규정 판단이 아니라 호환성 참고 목적이다.',
    },
    sortOrder: 30,
  },
  {
    id: 'season-capability-boundary',
    question: '시즌에 따라 어떤 기능이 달라지나요?',
    answer:
      '비시즌, 시즌 오픈, 시즌 매칭, 시즌 마감 정리 기간에 따라 프로필 작성, 탐색, 매칭 요청, 결과 확인 기능이 달라집니다.',
    policyCopyIds: ['season_capability_boundary'],
    source: {
      path: 'docs/04_policy/official/season-lifecycle.md',
      section: '시즌 상태 모델',
      reason: 'Landing FAQ는 4-state 시즌 모델을 기준으로 기능 on/off를 설명한다.',
    },
    sortOrder: 40,
  },
  {
    id: 'profile-privacy-warning',
    question: '프로필에 연락처나 민감정보를 적어도 되나요?',
    answer:
      '권장하지 않습니다. 연락처, SNS, 건강, 장애 여부 같은 개인정보·민감정보는 프로필과 자기소개에 적지 말고, 필요한 경우 매칭 확정 후 직접 판단해 공유해주세요.',
    policyCopyIds: ['profile_privacy_warning'],
    source: {
      path: 'docs/04_policy/official/data-retention.md',
      section: '채팅 데이터 분리 보관',
      reason: '사용자 입력 본문에 개인정보와 민감정보가 포함될 가능성을 줄인다.',
    },
    sortOrder: 50,
  },
  {
    id: 'faq-personal-support-request-boundary',
    question: 'FAQ로 해결되지 않으면 어떻게 문의하나요?',
    answer:
      'FAQ는 공개 도움말입니다. 개인 계정, 시즌 참여, 신고, 이의신청처럼 본인 상황 확인이 필요한 문제는 로그인 후 문의 기능을 통해 별도로 접수해야 합니다.',
    policyCopyIds: ['faq_is_not_personal_support_request'],
    source: {
      path: 'docs/04_policy/official/support-communication.md',
      section: 'FAQ policy',
      reason: 'FAQ는 개인 문의 접수를 대체하지 않고 개인 사건 결과를 포함하지 않는다.',
    },
    sortOrder: 60,
  },
] as const satisfies readonly LandingFallbackFaqItem[];
