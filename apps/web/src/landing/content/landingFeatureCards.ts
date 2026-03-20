import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Search,
  Cigarette,
  CheckCircle,
  Filter,
  UserCheck,
  Mail,
  Users,
  Clock,
  Moon,
  Volume2,
  Calendar,
  Shield,
  Info,
} from 'lucide-react';

interface FeatureCardItem {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
}

export const problemCards: FeatureCardItem[] = [
  {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    title: '무작위 배정 리스크',
    description: '생활 패턴이 맞지 않아 학기 내내 불편함을 겪는 경우가 많아요.',
  },
  {
    icon: Search,
    iconColor: 'text-red-500',
    title: '정보 파편화',
    description: '단톡방, SNS, 에브리타임 등 여러 채널에서 룸메를 찾아 혼란스러워요.',
  },
  {
    icon: Cigarette,
    iconColor: 'text-red-500',
    title: '흡연 여부',
    description: '흡연 여부를 미리 알 수 없어 흡연자와 비흡연자가 매칭되는 경우가 많아요.',
  },
];

export const solutionCards: FeatureCardItem[] = [
  {
    icon: CheckCircle,
    iconColor: 'text-[var(--knu-primary)]',
    title: '설문 기반 프로필',
    description: '흡연, 수면, 소음, 청결도 등 생활 패턴을 상세히 기록하고 비교할 수 있어요.',
  },
  {
    icon: Filter,
    iconColor: 'text-[var(--knu-primary)]',
    title: '후보 탐색·필터',
    description: '조건에 맞는 룸메 후보를 필터링하고 정렬하여 효율적으로 찾아요.',
  },
  {
    icon: UserCheck,
    iconColor: 'text-[var(--knu-primary)]',
    title: '확인 후 확정',
    description: '인트로 메시지를 주고받고 상대 프로필을 확인한 후 매칭을 확정해요.',
  },
];

export const featureCards: FeatureCardItem[] = [
  {
    icon: Mail,
    iconColor: 'text-[var(--knu-primary)]',
    title: '학교 이메일 인증',
    description: '@kangwon.ac.kr 이메일로 강원대 학생만 이용할 수 있어요.',
  },
  {
    icon: Users,
    iconColor: 'text-[var(--knu-primary)]',
    title: '룸메 후보 탐색',
    description: '학과, 학년, 성별, 생활 습관 등 원하는 조건으로 후보를 찾을 수 있어요.',
  },
  {
    icon: Clock,
    iconColor: 'text-[var(--knu-primary)]',
    title: '수면 패턴 비교',
    description: '취침/기상 시간과 생활 패턴을 비교해 불편함을 줄여요.',
  },
  {
    icon: Moon,
    iconColor: 'text-[var(--knu-primary)]',
    title: '소음·야행성 여부',
    description: '게임·유튜브·전화 습관 등 생활 소음 요소를 미리 확인할 수 있어요.',
  },
  {
    icon: Volume2,
    iconColor: 'text-[var(--knu-primary)]',
    title: '확인 후 확정',
    description: '매칭 요청 수락 후 상대 프로필을 확인하고 매칭을 확정해요.',
  },
  {
    icon: Calendar,
    iconColor: 'text-[var(--knu-primary)]',
    title: '시즌제 운영',
    description: '학교 공식 일정 기준으로 시즌이 운영되며, 비시즌에는 열람만 가능해요.',
  },
  {
    icon: Shield,
    iconColor: 'text-[var(--knu-primary)]',
    title: '안전한 환경',
    description: '학교 이메일 인증, 차단·신고 기능, 건물 기반 매칭으로 안전하게 이용할 수 있어요.',
  },
  {
    icon: Info,
    iconColor: 'text-[var(--knu-primary)]',
    title: '투명한 정보',
    description: '프로필에 기본 정보와 생활 패턴을 명확하게 제공해요.',
  },
];
