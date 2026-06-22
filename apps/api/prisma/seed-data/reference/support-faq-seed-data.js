export const SUPPORT_FAQ_REFERENCE_ROWS = [
  {
    id: 'landing-service-boundary-independent-service',
    category: 'OTHER',
    question: 'KNU 룸메는 학교 공식 서비스인가요?',
    answer:
      '아니요. KNU 룸메는 학교 공식 서비스가 아닌 독립 운영 서비스입니다. 학교 시스템과 연동하지 않고, 사용자가 입력한 정보로 룸메이트 탐색을 돕습니다.',
    published: true,
    sortOrder: 10,
    placements: [{ surface: 'LANDING', sortOrder: 10 }],
  },
  {
    id: 'landing-room-selection-not-guaranteed',
    category: 'MATCHING',
    question: '호실 선택이나 기숙사 배정을 보장하나요?',
    answer:
      '보장하지 않습니다. 서비스는 생활패턴과 조건을 비교해 룸메이트 탐색을 돕지만, 실제 호실 선택과 기숙사 배정은 학교 시스템에서 직접 진행됩니다.',
    published: true,
    sortOrder: 20,
    placements: [{ surface: 'LANDING', sortOrder: 20 }],
  },
  {
    id: 'landing-lifestyle-survey-disclaimer',
    category: 'MATCHING',
    question: '생활패턴 설문은 학교 규정과 관련이 있나요?',
    answer:
      '아닙니다. 생활패턴 설문은 룸메이트 호환성 비교를 위한 참고 자료이며, 학교 기숙사 규정상 허용행위를 뜻하거나 학교의 판단을 대체하지 않습니다.',
    published: true,
    sortOrder: 30,
    placements: [{ surface: 'LANDING', sortOrder: 30 }],
  },
  {
    id: 'landing-season-capability-boundary',
    category: 'SEASON',
    question: '시즌에 따라 어떤 기능이 달라지나요?',
    answer:
      '비시즌, 시즌 오픈, 시즌 매칭, 시즌 마감 정리 기간에 따라 프로필 작성, 탐색, 매칭 요청, 결과 확인 기능이 달라집니다.',
    published: true,
    sortOrder: 40,
    placements: [{ surface: 'LANDING', sortOrder: 40 }],
  },
  {
    id: 'landing-profile-privacy-warning',
    category: 'REPORT_OR_BLOCK',
    question: '프로필에 연락처나 민감정보를 적어도 되나요?',
    answer:
      '권장하지 않습니다. 연락처, SNS, 건강, 장애 여부 같은 개인정보·민감정보는 프로필과 자기소개에 적지 말고, 필요한 경우 매칭 확정 후 직접 판단해 공유해주세요.',
    published: true,
    sortOrder: 50,
    placements: [{ surface: 'LANDING', sortOrder: 50 }],
  },
  {
    id: 'landing-faq-not-support-ticket',
    category: 'OTHER',
    question: 'FAQ로 해결되지 않으면 어떻게 문의하나요?',
    answer:
      'FAQ는 공개 도움말입니다. 개인 계정, 시즌 참여, 신고, 이의신청처럼 본인 상황 확인이 필요한 문제는 로그인 후 문의 기능을 통해 별도로 접수해야 합니다.',
    published: true,
    sortOrder: 60,
    placements: [{ surface: 'LANDING', sortOrder: 60 }],
  },
];
