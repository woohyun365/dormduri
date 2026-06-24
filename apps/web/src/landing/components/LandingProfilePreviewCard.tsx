import { MessageCircle } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { LIFESTYLE_LABELS } from '@/constants/lifestyle';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import type { LandingProfilePreviewItem } from '../content/landing-profile-preview.examples';

interface LandingProfilePreviewCardProps {
  profile: LandingProfilePreviewItem;
}

function buildSummaryBadges(profile: LandingProfilePreviewItem): string[] {
  const { profileSummary } = profile;
  const badges = [
    profileSummary.smokingBehavior
      ? LIFESTYLE_LABELS.smokingBehavior[profileSummary.smokingBehavior]
      : null,
    profileSummary.sleepHabit
      ? `잠버릇 ${LIFESTYLE_LABELS.sleepHabit[profileSummary.sleepHabit]}`
      : null,
    profileSummary.relationshipStyle
      ? LIFESTYLE_LABELS.relationshipStyle[profileSummary.relationshipStyle]
      : null,
  ];

  return badges.filter((badge): badge is string => Boolean(badge));
}

function buildActionBadges(profile: LandingProfilePreviewItem): string[] {
  return [
    profile.actions.canRequestMatch ? '매칭 요청 가능' : null,
    profile.actions.canStartChat ? '대화 가능' : null,
  ].filter((badge): badge is string => Boolean(badge));
}

export function LandingProfilePreviewCard({ profile }: LandingProfilePreviewCardProps) {
  const summaryBadges = buildSummaryBadges(profile);
  const actionBadges = buildActionBadges(profile);
  const { nickname, intro } = profile.profileSummary;

  return (
    <article className="bg-white border-2 border-(--knu-border) rounded-2xl p-4 shadow-md hover:shadow-xl transition-all">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 ${profile.avatarBg} rounded-full flex items-center justify-center text-sm font-bold ${profile.avatarText} shrink-0`}
            aria-hidden="true"
          >
            {nickname.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-(--knu-text-primary) truncate">{nickname}</h3>
              <span className="px-1.5 py-0.5 rounded-md bg-(--knu-primary-light) text-[10px] font-bold text-(--knu-primary)">
                예시
              </span>
            </div>
            <p className="text-xs text-(--knu-text-tertiary)">{profile.displayDormitoryLabel}</p>
          </div>
        </div>
        {profile.exposure.scoreVisible && typeof profile.matchScore === 'number' ? (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getMatchScoreColor(profile.matchScore)}`}
            aria-label={`매칭 점수 ${profile.matchScore}퍼센트`}
          >
            매칭 {profile.matchScore}%
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {summaryBadges.map((badge) => (
          <Chip key={badge} label={badge} variant="badge" />
        ))}
      </div>

      <div className="flex items-start gap-1.5 px-3 py-2 bg-blue-50 rounded-xl mb-3">
        <MessageCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-blue-700 font-medium leading-relaxed line-clamp-2">
          <span className="sr-only">자기소개: </span>
          {intro}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3" aria-label="후보 행동 가능 여부">
        {actionBadges.map((badge) => (
          <span
            key={badge}
            className="rounded-full bg-(--knu-primary-light) px-2 py-1 text-[11px] font-semibold text-(--knu-primary)"
          >
            {badge}
          </span>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-(--knu-text-tertiary)">
        실제 사용자, 실제 점수, 매칭 또는 호실 선택 성공을 의미하지 않습니다.
      </p>
    </article>
  );
}
