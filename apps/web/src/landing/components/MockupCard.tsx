import { MessageCircle } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { getMatchScoreColor } from '@/utils/matchScoreColor';

interface MockupCardProps {
  variant: 'profile' | 'banner';
  profileIndex?: number;
}

interface MockProfile {
  nickname: string;
  dorm: string;
  matchScore: number;
  smokingBehavior: string;
  bedtime: string;
  cleanLevel: string;
  noiseSensitivity: string;
  intro: string;
  message: string | null;
  avatarBg: `bg-${string}`;
  avatarText: `text-${string}`;
}

const MOCK_PROFILES: MockProfile[] = [
  {
    nickname: '조용한하루',
    dorm: '다산관 2인실',
    matchScore: 95,
    smokingBehavior: '비흡연',
    bedtime: '22~24시',
    cleanLevel: '주 3회 이상',
    noiseSensitivity: '예민해요',
    intro: '조용하고 규칙적인 생활을 선호합니다.',
    message: '쓰레기통, 청소도구 제가 가져갑니다!',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-600',
  },
  {
    nickname: '새벽러너',
    dorm: '퇴계관 3인실',
    matchScore: 88,
    smokingBehavior: '비흡연',
    bedtime: '09~10시 이전',
    cleanLevel: '주 3회 이상',
    noiseSensitivity: '보통이에요',
    intro: '새벽 운동을 즐기고, 청결을 중요하게 생각합니다.',
    message: null,
    avatarBg: 'bg-cyan-100',
    avatarText: 'text-cyan-600',
  },
];

export function MockupCard({ variant, profileIndex = 0 }: MockupCardProps) {
  if (variant === 'banner') {
    return (
      <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-900">비시즌: 열람만 가능</p>
          <span className="text-sm font-semibold text-blue-600">시즌 안내</span>
        </div>
      </div>
    );
  }

  const profile = MOCK_PROFILES[profileIndex % MOCK_PROFILES.length]!;

  return (
    <div className="bg-white border-2 border-[var(--knu-border)] rounded-2xl p-4 shadow-md hover:shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${profile.avatarBg} rounded-full flex items-center justify-center text-sm font-bold ${profile.avatarText}`}
          >
            {profile.nickname.charAt(0)}
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--knu-text-primary)]">{profile.nickname}</h4>
            <p className="text-xs text-[var(--knu-text-tertiary)]">{profile.dorm}</p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${getMatchScoreColor(profile.matchScore)}`}
        >
          매칭 {profile.matchScore}%
        </span>
      </div>

      {/* Lifestyle Chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip label={`🚬\u00A0${profile.smokingBehavior}`} variant="badge" />
        <Chip label={`🕐\u00A0취침 ${profile.bedtime}`} variant="badge" />
        <Chip label={`✨\u00A0${profile.cleanLevel}`} variant="badge" />
        <Chip label={`🔊\u00A0${profile.noiseSensitivity}`} variant="badge" />
      </div>

      {/* Intro */}
      <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed line-clamp-1 mb-3">
        {profile.intro}
      </p>

      {/* Message to Roommate */}
      {profile.message && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-xl">
          <MessageCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700 font-medium line-clamp-1">{profile.message}</p>
        </div>
      )}
    </div>
  );
}
