import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CircleDashed,
  ClipboardCheck,
  Flag,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Shield,
  UserCheck,
} from 'lucide-react';
import type { LandingPolicyCopyId, LandingSeasonState } from './landing-content.types';
import { getLandingPolicyCopy } from './landing-policy-copy';

export interface LandingCtaCopy {
  label: string;
  href: Route;
}

export interface LandingHeroCopy {
  eyebrow: string;
  headlineLines: readonly string[];
  description: string;
  trustNotice: {
    title: string;
    description: string;
    actionLabel: string;
    targetId: string;
    policyCopyIds: readonly LandingPolicyCopyId[];
  };
  preview: {
    label: string;
    title: string;
    description: string;
    caption: string;
  };
  primaryCta: LandingCtaCopy;
  secondaryCta: {
    label: string;
    targetId: string;
  };
}

export interface LandingIconCopyItem {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  policyCopyIds?: readonly LandingPolicyCopyId[];
}

export interface LandingTrustBoundaryItem extends LandingIconCopyItem {
  iconSurfaceClass: string;
}

export interface LandingSupportItem extends LandingIconCopyItem {
  iconSurfaceClass: string;
  scopeLabel: string;
  scopeItems: readonly string[];
  entryLabel: string;
  entryValue: string;
  policyCopyIds: readonly LandingPolicyCopyId[];
}

export interface LandingHowItWorksStep {
  id: string;
  order: string;
  title: string;
  description: string;
  policyCopyIds?: readonly LandingPolicyCopyId[];
}

export interface LandingSeasonJourneyItem {
  state: LandingSeasonState;
  label: string;
  journeyLabel: string;
  journeyDateLabel: string;
  journeyDescription: string;
}

export interface LandingMatchingCapabilityStep {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  availabilityLabel: string;
  availabilityKind: 'schedule' | 'condition';
  policyCopyIds?: readonly LandingPolicyCopyId[];
}

export interface LandingFinalCtaCopy {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: LandingCtaCopy;
  policyCopyIds: readonly LandingPolicyCopyId[];
}

export const landingHeroCopy = {
  eyebrow: '강원대 기숙사 룸메이트 탐색 도우미',
  headlineLines: ['학기 시작 전,', '생활패턴이 맞는', '룸메이트를 찾아요'],
  description: '같은 캠퍼스의 후보를 생활패턴 기준으로 비교해요.',
  trustNotice: {
    title: '이용 전 확인',
    description: '학교 공식 서비스가 아니며, 기숙사 배정·호실 선택과 별도로 운영돼요.',
    actionLabel: '서비스 범위 보기',
    targetId: 'trust-boundary',
    policyCopyIds: [
      'service_independent_notice',
      'school_system_not_connected',
      'room_selection_not_guaranteed',
    ],
  },
  preview: {
    label: '서비스 화면 예시',
    title: '룸메 후보 목록은 이렇게 보여요',
    description: '서로 잘 맞는지 한눈에 비교할 수 있어요.',
    caption: '실제 사용자 정보가 아닌 이해를 돕기 위한 예시예요.',
  },
  primaryCta: {
    label: '학교 이메일로 시작하기',
    href: '/signup',
  },
  secondaryCta: {
    label: '이용 흐름 보기',
    targetId: 'how-it-works',
  },
} as const satisfies LandingHeroCopy;

export const landingTrustBoundaryCopy = {
  eyebrow: '서비스 범위',
  title: 'KNU 룸메 서비스',
  description: 'KNU 룸메는 룸메이트를 구하는 과정을 도와요.',
} as const;

export const landingTrustBoundaryItems = [
  {
    id: 'independent-service',
    icon: Shield,
    iconColor: 'text-(--knu-primary)',
    iconSurfaceClass: 'border-blue-100 bg-blue-50',
    title: '독립 운영 서비스',
    description: getLandingPolicyCopy('service_independent_notice').copy,
    policyCopyIds: ['service_independent_notice'],
  },
  {
    id: 'not-connected-to-school',
    icon: CircleDashed,
    iconColor: 'text-slate-500',
    iconSurfaceClass: 'border-slate-200 bg-slate-100',
    title: '학교 시스템 미연동',
    description: getLandingPolicyCopy('school_system_not_connected').copy,
    policyCopyIds: ['school_system_not_connected'],
  },
  {
    id: 'room-selection-not-guaranteed',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    iconSurfaceClass: 'border-amber-100 bg-amber-50',
    title: '호실 선택은 별도',
    description: getLandingPolicyCopy('room_selection_not_guaranteed').copy,
    policyCopyIds: ['room_selection_not_guaranteed'],
  },
  {
    id: 'lifestyle-survey-disclaimer',
    icon: ClipboardCheck,
    iconColor: 'text-emerald-600',
    iconSurfaceClass: 'border-emerald-100 bg-emerald-50',
    title: '생활패턴은 참고용',
    description: getLandingPolicyCopy('lifestyle_survey_disclaimer').copy,
    policyCopyIds: ['lifestyle_survey_disclaimer'],
  },
] as const satisfies readonly LandingTrustBoundaryItem[];

export const landingHowItWorksSteps = [
  {
    id: 'email-signup',
    order: '01',
    title: '학교 이메일로 가입',
    description: '학교 이메일로 재학생 인증하고 회원가입해요.',
  },
  {
    id: 'profile-registration',
    order: '02',
    title: '시즌 프로필 작성',
    description: '나의 생활패턴·원하는 룸메 조건을 입력해요.',
  },
  {
    id: 'search-and-chat',
    order: '03',
    title: '후보 탐색과 대화',
    description: '같은 기숙사 후보를 살펴보고, 대화하거나 매칭을 요청해요.',
  },
] as const satisfies readonly LandingHowItWorksStep[];

export const landingHowItWorksCopy = {
  eyebrow: '이용 순서',
  title: '이렇게 이용해요',
  description: '같은 기숙사 후보의 시즌 프로필을 확인하고 대화해요.',
  notice: {
    title: '학기별 매칭 일정이 있어요',
    description: '프로필 등록·후보 탐색·매칭은 정해진 기간에만 이용할 수 있어요.',
    policyCopyIds: ['season_capability_boundary'],
  },
} as const;

export const landingSeasonJourneyItems = [
  {
    state: 'OFF_SEASON',
    label: '비시즌',
    journeyLabel: '지난 이력 확인',
    journeyDateLabel: '~ 8. 1.',
    journeyDescription: '이전 시즌 기록을 확인해요.',
  },
  {
    state: 'SEASON_OPEN',
    label: '시즌 오픈',
    journeyLabel: '시즌 준비',
    journeyDateLabel: '8. 2. ~ 8. 10.',
    journeyDescription: '프로필을 등록하고 후보와 대화해요.',
  },
  {
    state: 'SEASON_MATCHING',
    label: '시즌 매칭',
    journeyLabel: '매칭 진행',
    journeyDateLabel: '8. 11. ~ 8. 20.',
    journeyDescription: '요청을 주고받아 매칭을 확정해요.',
  },
  {
    state: 'SEASON_POST_MATCH',
    label: '시즌 마감 정리 기간',
    journeyLabel: '결과 확인',
    journeyDateLabel: '8. 21. ~ 8. 31.',
    journeyDescription: '이번 시즌 결과와 매칭 상대를 확인해요.',
  },
] as const satisfies readonly LandingSeasonJourneyItem[];

export const landingMatchingCapabilitySteps = [
  {
    id: 'season-registration',
    icon: ClipboardCheck,
    title: '시즌 등록',
    description: '프로필과 기숙사 정보를 준비해요.',
    availabilityLabel: '시즌 오픈·매칭',
    availabilityKind: 'schedule',
    policyCopyIds: ['season_capability_boundary'],
  },
  {
    id: 'candidate-chat',
    icon: MessageCircle,
    title: '후보와 대화',
    description: '후보를 찾고 생활패턴을 비교한 뒤 대화해요.',
    availabilityLabel: '시즌 등록 후',
    availabilityKind: 'condition',
    policyCopyIds: ['lifestyle_survey_disclaimer', 'profile_privacy_warning'],
  },
  {
    id: 'match-request',
    icon: UserCheck,
    title: '요청·수락',
    description: '매칭 요청을 보내거나 받은 요청에 응답해요.',
    availabilityLabel: '시즌 매칭',
    availabilityKind: 'schedule',
    policyCopyIds: ['season_capability_boundary'],
  },
  {
    id: 'matched-chat',
    icon: MessagesSquare,
    title: '매칭 상대와 대화',
    description: '매칭 확정 후 입실 전 생활방식을 조율해요.',
    availabilityLabel: '매칭 확정 후',
    availabilityKind: 'condition',
    policyCopyIds: ['profile_privacy_warning'],
  },
] as const satisfies readonly LandingMatchingCapabilityStep[];

export const landingSupportCopy = {
  eyebrow: '이용 도움',
  title: '서비스 이용 중 도움이 필요하다면',
  description: '상황에 맞는 도움 방법을 확인해요.',
  policyCopyIds: ['support_channel_boundary'],
} as const;

export const landingSupportPrivacyNotice = {
  title: '공개 정보는 꼭 필요한 만큼만',
  items: [
    {
      label: '내 공개 프로필',
      description: '실명·학번·연락처·SNS 등 개인 정보는 적지 않는 것을 권장해요.',
    },
    {
      label: '타인 정보',
      description: '개인정보나 사생활 정보를 동의 없이 공개하지 마세요.',
    },
  ],
  policyCopyIds: ['profile_privacy_warning'],
} as const;

export const landingSupportItems = [
  {
    id: 'contextual-report',
    icon: Flag,
    iconColor: 'text-rose-500',
    iconSurfaceClass: 'bg-rose-50',
    title: '신고·차단',
    description: '프로필·채팅 문제를 신고하거나 상대를 차단해요.',
    scopeLabel: '신고할 수 있는 내용',
    scopeItems: [
      '욕설·성적 표현이 있는 닉네임·자기소개',
      '성별 사칭이나 허위 기숙사·생활패턴 정보',
      '장애·성적 지향 등에 대한 혐오·차별 표현',
      '협박·개인정보 노출·반복 스팸 채팅',
    ],
    entryLabel: '이용 위치',
    entryValue: '상대 프로필·채팅 화면',
    policyCopyIds: ['support_channel_boundary'],
  },
  {
    id: 'signed-in-support',
    icon: MessageSquareText,
    iconColor: 'text-(--knu-primary)',
    iconSurfaceClass: 'bg-blue-50',
    title: '서비스 이용 문의',
    description: '직접 해결하기 어려운 서비스 이용 문제를 문의해요.',
    scopeLabel: '문의 범위',
    scopeItems: [
      '철회한 시즌 재참여 문의',
      '등록을 마친 뒤 기숙사 오입력 수정',
      '캠퍼스·출생연도·단과대 정보 정정',
      '신고·제재 결과 재검토',
    ],
    entryLabel: '이용 위치',
    entryValue: '로그인 후 문의하기 페이지',
    policyCopyIds: ['support_channel_boundary'],
  },
] as const satisfies readonly LandingSupportItem[];

export const landingFinalCtaCopy = {
  eyebrow: '시작하기',
  title: '룸메이트 찾기를 시작해 보세요',
  description: '학교 이메일로 간편하게 시작할 수 있어요.',
  primaryCta: {
    label: '학교 이메일로 시작하기',
    href: '/signup',
  },
  policyCopyIds: [],
} as const satisfies LandingFinalCtaCopy;

export const landingFooterCopy = {
  externalInquiryEmail: 'woohyun365@gmail.com',
} as const;

export const landingSectionIds = [
  'hero',
  'trust-boundary',
  'how-it-works',
  'features',
  'season',
  'support',
  'final-cta',
] as const;

export const landingSectionHeadings = [
  '학기 시작 전',
  'KNU 룸메 서비스',
  '이렇게 이용해요',
  '주요 기능',
  '시즌에 따라 달라요',
  '서비스 이용 중 도움이 필요하다면',
  '룸메이트 찾기를 시작해 보세요',
] as const;

export const LANDING_POLICY_LINKED_CONTENT_GROUPS = [
  [landingHeroCopy.trustNotice],
  [landingHowItWorksCopy.notice],
  landingTrustBoundaryItems,
  landingHowItWorksSteps,
  landingMatchingCapabilitySteps,
  [landingSupportCopy],
  [landingSupportPrivacyNotice],
  landingSupportItems,
] as const;
