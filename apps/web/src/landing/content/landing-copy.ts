import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CircleDashed,
  ClipboardCheck,
  Filter,
  HelpCircle,
  Info,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Search,
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
  policyCopyIds: readonly LandingPolicyCopyId[];
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

export interface LandingHowItWorksStep {
  id: string;
  order: string;
  title: string;
  description: string;
  note?: string;
  policyCopyIds?: readonly LandingPolicyCopyId[];
}

export interface LandingSeasonPolicyCard {
  state: LandingSeasonState;
  label: string;
  description: string;
  available: readonly string[];
  unavailable: readonly string[];
  accent: 'neutral' | 'blue' | 'primary' | 'amber';
}

export interface LandingFinalCtaCopy {
  title: string;
  description: string;
  primaryCta: LandingCtaCopy;
  secondaryCta: LandingCtaCopy;
  policyCopyIds: readonly LandingPolicyCopyId[];
}

export const landingHeroCopy = {
  eyebrow: '강원대학교 춘천캠퍼스 룸메이트 탐색 도우미',
  headlineLines: ['학기 시작 전,', '생활패턴이 맞는', '룸메 후보를 확인하세요'],
  description:
    '학교 이메일 인증 후 같은 캠퍼스·시즌 조건의 룸메 후보를 생활패턴 기준으로 비교합니다.',
  policyCopyIds: [
    'service_independent_notice',
    'school_system_not_connected',
    'room_selection_not_guaranteed',
  ],
  primaryCta: {
    label: '이메일로 시작하기',
    href: '/signup',
  },
  secondaryCta: {
    label: '이용 흐름 보기',
    targetId: 'how-it-works',
  },
} as const satisfies LandingHeroCopy;

export const landingTrustBoundaryItems = [
  {
    id: 'independent-service',
    icon: Shield,
    iconColor: 'text-(--knu-primary)',
    title: '독립 운영 서비스',
    description: getLandingPolicyCopy('service_independent_notice').copy,
    policyCopyIds: ['service_independent_notice'],
  },
  {
    id: 'not-connected-to-school',
    icon: CircleDashed,
    iconColor: 'text-slate-500',
    title: '학교 시스템 미연동',
    description: getLandingPolicyCopy('school_system_not_connected').copy,
    policyCopyIds: ['school_system_not_connected'],
  },
  {
    id: 'room-selection-not-guaranteed',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    title: '호실 선택 보장 아님',
    description: getLandingPolicyCopy('room_selection_not_guaranteed').copy,
    policyCopyIds: ['room_selection_not_guaranteed'],
  },
  {
    id: 'lifestyle-survey-disclaimer',
    icon: ClipboardCheck,
    iconColor: 'text-emerald-600',
    title: '생활패턴은 참고용',
    description: getLandingPolicyCopy('lifestyle_survey_disclaimer').copy,
    policyCopyIds: ['lifestyle_survey_disclaimer'],
  },
] as const satisfies readonly LandingIconCopyItem[];

export const landingHowItWorksSteps = [
  {
    id: 'email-signup',
    order: '01',
    title: '학교 이메일로 가입',
    description: '@kangwon.ac.kr 인증 후 지원 캠퍼스와 시즌 상태를 확인합니다.',
  },
  {
    id: 'profile-registration',
    order: '02',
    title: '시즌 프로필 작성',
    description:
      '등록 전에는 기숙사 선택 정보와 생활패턴을 작성·수정합니다. 등록 완료 후에는 시즌 프로필과 기숙사 선택 정보가 잠깁니다.',
    note: getLandingPolicyCopy('season_capability_boundary').copy,
    policyCopyIds: ['season_capability_boundary'],
  },
  {
    id: 'search-and-chat',
    order: '03',
    title: '후보 탐색과 대화',
    description:
      '열려 있는 시즌·기숙사 범위에서 후보를 확인합니다. 조건을 만족하면 매칭 전에도 대화하고, 허용된 화면에서 매칭을 요청할 수 있습니다.',
    note: '실제 호실 선택과 기숙사 배정은 학교 시스템에서 진행됩니다.',
    policyCopyIds: ['school_system_not_connected', 'room_selection_not_guaranteed'],
  },
] as const satisfies readonly LandingHowItWorksStep[];

export const landingFeatureItems = [
  {
    id: 'email-verification',
    icon: Mail,
    iconColor: 'text-(--knu-primary)',
    title: '학교 이메일 인증',
    description: '@kangwon.ac.kr 이메일 인증을 기준으로 가입 자격을 확인합니다.',
  },
  {
    id: 'candidate-search',
    icon: Search,
    iconColor: 'text-(--knu-primary)',
    title: '후보 탐색',
    description: '시즌과 내 상태에 맞는 후보 카드만 확인합니다.',
  },
  {
    id: 'lifestyle-compare',
    icon: Moon,
    iconColor: 'text-(--knu-primary)',
    title: '생활패턴 비교',
    description: '수면, 흡연, 청결, 소음 민감도 같은 호환성 정보를 참고합니다.',
    policyCopyIds: ['lifestyle_survey_disclaimer'],
  },
  {
    id: 'filter-and-sort',
    icon: Filter,
    iconColor: 'text-(--knu-primary)',
    title: '필터와 정렬',
    description: '선택 가능한 탐색 범위와 공개된 후보 정보를 기준으로 후보를 좁혀봅니다.',
  },
  {
    id: 'confirm-before-match',
    icon: UserCheck,
    iconColor: 'text-(--knu-primary)',
    title: '확인 후 매칭',
    description:
      '상대 프로필과 상태를 확인한 뒤 허용된 화면에서 매칭을 요청하고 수락 여부를 결정합니다.',
  },
  {
    id: 'in-service-chat',
    icon: MessageCircle,
    iconColor: 'text-(--knu-primary)',
    title: '서비스 내 대화',
    description:
      '같은 기숙사·등록 완료 조건을 만족하면 매칭 전에도 대화할 수 있습니다. 매칭 후에는 확정 상대와 계속 대화할 수 있습니다.',
    policyCopyIds: ['profile_privacy_warning'],
  },
  {
    id: 'safety-controls',
    icon: Shield,
    iconColor: 'text-(--knu-primary)',
    title: '차단·신고 경계',
    description: '불편한 사용자는 차단하고, 정책 위반은 신고·지원 흐름으로 분리해 접수합니다.',
  },
  {
    id: 'transparent-boundary',
    icon: Info,
    iconColor: 'text-(--knu-primary)',
    title: '투명한 서비스 경계',
    description: '서비스가 돕는 범위와 학교 시스템이 결정하는 범위를 함께 안내합니다.',
    policyCopyIds: ['school_system_not_connected', 'room_selection_not_guaranteed'],
  },
] as const satisfies readonly LandingIconCopyItem[];

export const landingSeasonPolicyCards = [
  {
    state: 'OFF_SEASON',
    label: '비시즌',
    description: '시즌 외 기간입니다. 다른 사용자 프로필 탐색과 이번 시즌 프로필 작성은 닫힙니다.',
    available: ['내 표시 정보와 과거 이력 확인', '서비스 정책·FAQ 확인'],
    unavailable: ['타인 프로필 탐색', '시즌 프로필 작성', '매칭 요청·수락'],
    accent: 'neutral',
  },
  {
    state: 'SEASON_OPEN',
    label: '시즌 오픈',
    description:
      '등록 전에는 프로필을 작성·수정하고, 등록 후에는 같은 기숙사 후보 확인과 직접 대화가 가능합니다. 매칭 요청·수락은 시즌 매칭 기간에만 열립니다.',
    available: [
      '등록 전 시즌 프로필 작성·수정',
      '기숙사 선택 정보 임시 저장',
      '후보 목록 확인',
      '같은 기숙사 후보와 직접 대화',
    ],
    unavailable: ['매칭 요청·수락', '등록 완료 후 프로필·기숙사 선택 정보 수정'],
    accent: 'blue',
  },
  {
    state: 'SEASON_MATCHING',
    label: '시즌 매칭',
    description:
      '등록 완료 사용자는 같은 기숙사 후보와 대화하고 매칭을 요청할 수 있습니다. 등록 후 잠금은 유지됩니다.',
    available: ['같은 기숙사 후보 탐색', '매칭 전 직접 대화', '매칭 요청·수락', '매칭 후 1:1 대화'],
    unavailable: ['등록 완료 후 프로필·기숙사 선택 정보 수정'],
    accent: 'primary',
  },
  {
    state: 'SEASON_POST_MATCH',
    label: '시즌 마감 정리 기간',
    description: '새 시즌 참여 등록과 새 매칭은 종료되고, 확정 결과 확인 중심으로 전환됩니다.',
    available: ['확정 결과 확인', '읽기 전용 프로필·이력 안내'],
    unavailable: ['신규 시즌 참여 등록', '신규 매칭 요청'],
    accent: 'amber',
  },
] as const satisfies readonly LandingSeasonPolicyCard[];

export const landingSafetySupportItems = [
  {
    id: 'privacy-warning',
    icon: Lock,
    iconColor: 'text-rose-600',
    title: '개인정보 입력 주의',
    description: getLandingPolicyCopy('profile_privacy_warning').copy,
    policyCopyIds: ['profile_privacy_warning'],
  },
  {
    id: 'faq-boundary',
    icon: HelpCircle,
    iconColor: 'text-(--knu-primary)',
    title: 'FAQ는 공개 도움말',
    description: getLandingPolicyCopy('faq_is_not_support_ticket').copy,
    policyCopyIds: ['faq_is_not_support_ticket'],
  },
  {
    id: 'report-support',
    icon: Shield,
    iconColor: 'text-emerald-600',
    title: '신고·문의는 별도 접수',
    description:
      '계정, 시즌 참여, 신고, 이의신청처럼 본인 상황 확인이 필요한 문제는 로그인 후 문의 기능으로 접수합니다.',
    policyCopyIds: ['faq_is_not_support_ticket'],
  },
] as const satisfies readonly LandingIconCopyItem[];

export const landingFinalCtaCopy = {
  title: '공개 안내를 확인했다면, 내 시즌 상태에 맞게 시작하세요',
  description:
    '가입 후에는 시즌·등록 상태에 맞는 기능만 열립니다. 기숙사 배정과 호실 선택 결과는 학교 시스템에서 결정됩니다.',
  primaryCta: {
    label: '학교 이메일로 가입하기',
    href: '/signup',
  },
  secondaryCta: {
    label: '이미 계정이 있어요',
    href: '/login',
  },
  policyCopyIds: ['season_capability_boundary', 'room_selection_not_guaranteed'],
} as const satisfies LandingFinalCtaCopy;

export const landingSectionIds = [
  'hero',
  'trust-boundary',
  'how-it-works',
  'features',
  'season',
  'safety-support',
  'faq',
  'final-cta',
] as const;

export const landingSectionHeadings = [
  '생활패턴이 맞는',
  '서비스 경계를 먼저 확인하세요',
  '이렇게 이용해요',
  '주요 기능',
  '시즌별로 열리는 기능이 달라요',
  '안전과 문의 경계',
  '자주 묻는 질문',
  '공개 안내를 확인했다면',
] as const;

export const LANDING_POLICY_LINKED_CONTENT_GROUPS = [
  landingTrustBoundaryItems,
  landingHowItWorksSteps,
  landingFeatureItems,
  landingSafetySupportItems,
] as const;
