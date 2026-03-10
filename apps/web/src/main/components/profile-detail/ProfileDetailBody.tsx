import { MessageCircle } from 'lucide-react';
import { LIFESTYLE_FIELD_NAMES, getLifestyleLabel } from '@/constants/lifestyle';
import {
  ADDITIONAL_FIELD_NAMES,
  GRADES,
  TEMPERATURE_SENSITIVITY,
} from '@/constants/additional-profile';
import { getAvatarColor } from '@/utils/avatarColor';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import { getDormitoryLabel } from '@/utils/dormitoryLabel';
import { ContextualTip } from '@/components/ContextualTip';
import { CompatibilityReport } from '../CompatibilityReport';
import type { RoommateProfile } from '@/types/profile';
import type { LifestyleData } from '@/types/lifestyle';

const LIFESTYLE_FIELDS = Object.keys(LIFESTYLE_FIELD_NAMES) as (keyof LifestyleData)[];

interface ProfileDetailBodyProps {
  profile: RoommateProfile;
  userLifestyle?: LifestyleData;
  showMatchRequestTip?: boolean;
  onDismissMatchRequestTip?: () => void;
}

export function ProfileDetailBody({
  profile,
  userLifestyle,
  showMatchRequestTip,
  onDismissMatchRequestTip,
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
        <span
          className={`px-3 py-1.5 rounded-full text-sm font-bold ${getMatchScoreColor(profile.matchScore)}`}
        >
          매칭 {profile.matchScore}%
        </span>
      </div>

      {/* Lifestyle Grid */}
      <div className="bg-[var(--knu-background-alt)] rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3">
          {LIFESTYLE_FIELDS.map((field) => (
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
      {userLifestyle && (
        <CompatibilityReport userLifestyle={userLifestyle} profileLifestyle={profile.lifestyle} />
      )}

      {/* Additional Info */}
      {(profile.additional.college ||
        profile.additional.grade ||
        profile.additional.mbti ||
        profile.additional.temperatureSensitivity) && (
        <div className="bg-[var(--knu-background-alt)] rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-3">
            {profile.additional.college && (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                  {ADDITIONAL_FIELD_NAMES.college}
                </p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {profile.additional.college}
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
            {profile.additional.temperatureSensitivity && (
              <div>
                <p className="text-xs text-[var(--knu-text-tertiary)] mb-0.5">
                  {ADDITIONAL_FIELD_NAMES.temperatureSensitivity}
                </p>
                <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  {
                    TEMPERATURE_SENSITIVITY.find(
                      (t) => t.value === profile.additional.temperatureSensitivity,
                    )?.label
                  }
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

      {/* Match Request Tip */}
      {showMatchRequestTip && onDismissMatchRequestTip && (
        <ContextualTip
          message="상대방이 수락하면 매칭이 성사돼요"
          onDismiss={onDismissMatchRequestTip}
        />
      )}
    </div>
  );
}
