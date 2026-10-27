// Landing이 반드시 보이는 정책 고지와 그 원본. 면책 고지 넷(service_independent_notice·school_system_not_connected·
// room_selection_not_guaranteed·lifestyle_survey_disclaimer)은 법적 책임 문구라 글자를 바꾸지 않는다.
export type LandingPolicyCopyId =
  | 'service_independent_notice'
  | 'school_system_not_connected'
  | 'room_selection_not_guaranteed'
  | 'lifestyle_survey_disclaimer'
  | 'profile_privacy_warning'
  | 'season_capability_boundary'
  | 'support_channel_boundary';

// 고지가 보이는 화면 영역: 첫 화면, 알아두세요, 시즌, footer.
export type LandingPolicySurface = 'hero' | 'notices' | 'season' | 'footer';

export interface LandingPolicySourceRef {
  readonly path: `docs/policies/${string}.md`;
  readonly section: string;
  readonly reason: string;
}

export interface LandingPolicyCopy {
  readonly id: LandingPolicyCopyId;
  readonly copy: string;
  readonly source: LandingPolicySourceRef;
  readonly requiredSurface: readonly LandingPolicySurface[];
  readonly testAnchor: string;
}

export const LANDING_REQUIRED_POLICY_COPY_IDS = [
  'service_independent_notice',
  'school_system_not_connected',
  'room_selection_not_guaranteed',
  'lifestyle_survey_disclaimer',
  'profile_privacy_warning',
  'season_capability_boundary',
  'support_channel_boundary',
] as const satisfies readonly LandingPolicyCopyId[];

// 고지를 담는 화면 영역의 element id. 섹션이 이 id를 쓰고, test가 고지가 제 영역에 있는지 이 id로 확인한다.
export const LANDING_SURFACE_SECTION_IDS = {
  hero: 'hero',
  notices: 'notices',
  season: 'season',
  footer: 'landing-footer',
} as const satisfies Record<LandingPolicySurface, string>;

export const LANDING_POLICY_COPY = [
  {
    id: 'service_independent_notice',
    copy: 'KNU 룸메는 학교 공식 서비스가 아닙니다.',
    source: {
      path: 'docs/policies/service-boundary.md',
      section: '면책 고지 시점',
      reason: '서비스 진입 화면에서 비공식 서비스 고지를 유지해야 한다.',
    },
    requiredSurface: ['hero', 'footer'],
    testAnchor: '학교 공식 서비스가 아닙니다',
  },
  {
    id: 'school_system_not_connected',
    copy: '학교 기숙사 시스템과 연동되지 않으며, 사용자에게 룸메이트 탐색을 돕습니다.',
    source: {
      path: 'docs/policies/service-boundary.md',
      section: '서비스 기능 범위',
      reason:
        '학교 시스템 연동을 하지 않으므로 학교 시스템 일정과 권한을 보장하지 않는다는 경계를 노출해야 한다.',
    },
    requiredSurface: ['notices'],
    testAnchor: '학교 기숙사 시스템과 연동되지 않으며',
  },
  {
    id: 'room_selection_not_guaranteed',
    copy: '기숙사 배정·호실 선택을 보장하지 않습니다.',
    source: {
      path: 'docs/policies/service-boundary.md',
      section: '면책 범위',
      reason: '호실 선택은 학교 시스템 영역이며 서비스가 성공을 보장하지 않는다.',
    },
    requiredSurface: ['hero', 'notices'],
    testAnchor: '기숙사 배정·호실 선택을 보장하지 않습니다',
  },
  {
    id: 'lifestyle_survey_disclaimer',
    copy: '룸메 적합도 계산에 사용되며, 학교 기숙사 규정 판단이 아닙니다.',
    source: {
      path: 'docs/policies/service-boundary.md',
      section: '면책 범위',
      reason: '생활패턴 설문은 학교 규정상 허용행위를 뜻하지 않는다.',
    },
    requiredSurface: ['notices'],
    testAnchor: '학교 기숙사 규정 판단이 아닙니다',
  },
  {
    id: 'profile_privacy_warning',
    // 무엇을 조심할지(개인정보)를 바로 말하고, 알아두세요 목록의 면책 문장과 같은 합니다체로 맞춘다(Owner 확인
    // 2026-10-26, fe.md `fe.ds.copy-style`).
    copy: '개인정보는 필요한 범위만 공개하기를 권합니다.',
    source: {
      path: 'docs/policies/data-retention.md',
      section: '채팅 데이터 분리 보관',
      reason:
        '사용자 입력 본문에는 개인정보와 민감정보가 포함될 수 있으므로 공개 입력 surface에서 주의를 제공한다.',
    },
    requiredSurface: ['notices'],
    testAnchor: '필요한 범위만 공개',
  },
  {
    id: 'season_capability_boundary',
    // 기간 이름(비시즌·시즌 오픈·시즌 매칭·시즌 마감 정리)은 랜딩에서 설명하지 않으므로, 방문자가 아는 기능 이름으로
    // 같은 뜻을 쓴다(Owner 확인 2026-10-26). 기능별 열림은 같은 문서 "상태별 기능 허용 범위".
    copy: '후보 보기·대화·매칭 신청은 시즌 중에만 열리고, 기간마다 열리는 기능이 달라요.',
    source: {
      path: 'docs/policies/season-lifecycle.md',
      section: '시즌 상태 모델',
      reason:
        '시즌 상태마다 열리는 기능이 다르므로, Landing은 상태 이름 대신 방문자가 아는 기능 이름으로 그 경계를 알린다.',
    },
    requiredSurface: ['season'],
    testAnchor: '시즌 중에만 열리고',
  },
  {
    id: 'support_channel_boundary',
    // 알아두세요 목록의 면책 문장과 같은 합니다체(Owner 확인 2026-10-26, fe.md `fe.ds.copy-style`).
    copy: '신고·차단은 프로필·채팅에서, 문의는 로그인 후 접수합니다.',
    source: {
      path: 'docs/policies/support-communication.md',
      section: 'API/access baseline',
      reason:
        '문의 접수는 로그인 뒤 protected 화면에서만 열리므로 공개 랜딩은 상황별 신고·문의 위치만 안내하고 개인 사건을 직접 처리하지 않는다.',
    },
    requiredSurface: ['notices'],
    testAnchor: '로그인 후',
  },
] as const satisfies readonly LandingPolicyCopy[];

export function getLandingPolicyCopy(id: LandingPolicyCopyId): LandingPolicyCopy {
  const copy = LANDING_POLICY_COPY.find((item) => item.id === id);

  if (!copy) {
    throw new Error(`Missing landing policy copy: ${id}`);
  }

  return copy;
}
