import { MessageCircle, Lock, AlertCircle } from 'lucide-react';
import { LIFESTYLE_FIELD_NAMES, getLifestyleLabel } from '@/constants/lifestyle';
import { ADDITIONAL_FIELD_NAMES, GRADES, getCollegeLabel } from '@/constants/additional-profile';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { CompatibilityReport } from '../CompatibilityReport';
import type { RoommateProfile } from '@/types/profile';
import type { MatchScoreType } from '@/utils/matchScore';
import type { LifestyleData } from '@/types/lifestyle';

// 음주 필드(drinkingFrequency, drinkingTolerance)는 정책(AC-N8)에 따라 표시 제외
const DISPLAY_LIFESTYLE_FIELDS: (keyof LifestyleData)[] = [
  'smokingBehavior',
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'noiseSensitivity',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'relationshipStyle',
  'temperatureSensitivity',
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'cleanExpectation',
];

interface ProfileDetailBodyProps {
  profile: RoommateProfile;
  scoreType?: MatchScoreType;
  userLifestyle?: LifestyleData;
}

export function ProfileDetailBody({
  profile,
  scoreType = 'full',
  userLifestyle,
}: ProfileDetailBodyProps) {
  const dormLabel = getDormitoryLabel(profile.dormitoryId);
  const avatarColor = getAvatarColor(profile.nickname);

  return (
    <div className="p-5 pb-5 space-y-5">
      {/* Avatar + Nickname + Dorm + Match */}
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 ${avatarColor.bg} rounded-full flex items-center justify-center text-2xl font-bold ${avatarColor.text}`}
        >
          {profile.nickname.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">{profile.nickname}</h3>
          {dormLabel && <p className="text-sm text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
        </div>
        {scoreType === 'gated' ? (
          <span className="px-3 py-1.5 rounded-full text-sm font-bold text-gray-400 bg-gray-100 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            잠김
          </span>
        ) : (
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${getMatchScoreColor(profile.matchScore)}`}
          >
            매칭 {profile.matchScore}%{scoreType === 'partial' && ' (!)'}
          </span>
        )}
      </div>

      {/* Lifestyle Grid */}
      <div className="bg-[var(--knu-background-alt)] rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3">
          {DISPLAY_LIFESTYLE_FIELDS.map((field) => (
            <div key={field}>
              <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                {LIFESTYLE_FIELD_NAMES[field]}
              </p>
              <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                {getLifestyleLabel(field, profile.lifestyle[field])}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Compatibility Report */}
      {userLifestyle && scoreType === 'gated' && (
        <div className="relative rounded-2xl overflow-hidden">
          <div className="blur-sm pointer-events-none opacity-50">
            <CompatibilityReport
              userLifestyle={userLifestyle}
              profileLifestyle={profile.lifestyle}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <div className="text-center px-6 py-4">
              <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-[var(--knu-text-primary)] mb-1">
                호환성 분석 잠김
              </p>
              <p className="text-xs text-[var(--knu-text-secondary)]">
                조건을 입력하면 호환성 분석을 볼 수 있어요
              </p>
            </div>
          </div>
        </div>
      )}
      {userLifestyle && scoreType === 'partial' && (
        <div>
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-amber-50 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              내 기준 호환성입니다. 상대가 조건을 입력하면 상세 비교를 볼 수 있어요.
            </p>
          </div>
          <CompatibilityReport userLifestyle={userLifestyle} profileLifestyle={profile.lifestyle} />
        </div>
      )}
      {userLifestyle && scoreType === 'full' && (
        <CompatibilityReport userLifestyle={userLifestyle} profileLifestyle={profile.lifestyle} />
      )}

      {/* Additional Info */}
      {(profile.additional.college ||
        profile.additional.grade ||
        profile.additional.mbti ||
        profile.additional.birthYear) && (
        <div className="bg-[var(--knu-background-alt)] rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-3">
            {profile.additional.college && (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                  {ADDITIONAL_FIELD_NAMES.college}
                </p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {getCollegeLabel(profile.additional.college) ?? profile.additional.college}
                </p>
              </div>
            )}
            {profile.additional.grade && (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                  {ADDITIONAL_FIELD_NAMES.grade}
                </p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {GRADES.find((g) => g.value === profile.additional.grade)?.label ??
                    profile.additional.grade}
                </p>
              </div>
            )}
            {profile.additional.mbti && (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                  {ADDITIONAL_FIELD_NAMES.mbti}
                </p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {profile.additional.mbti}
                </p>
              </div>
            )}
            {profile.additional.birthYear && (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                  {ADDITIONAL_FIELD_NAMES.birthYear}
                </p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {profile.additional.birthYear}년
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Intro */}
      <div>
        <p className="text-xs text-[var(--knu-text-tertiary)] mb-1.5">자기소개</p>
        <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed">{profile.intro}</p>
      </div>

      {/* Message to Roommate */}
      {profile.messageToRoommate && (
        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageCircle className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold text-blue-700">룸메에게 한마디</p>
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">{profile.messageToRoommate}</p>
        </div>
      )}
    </div>
  );
}
