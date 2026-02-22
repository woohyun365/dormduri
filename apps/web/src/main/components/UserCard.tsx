'use client';

import { ChevronRight, MessageCircle } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { getLifestyleLabel } from '@/constants/lifestyle';
import { getDormitoryById } from '@/constants/dormitory';
import { getAvatarColor } from '../utils/avatarColor';
import type { LifestyleData } from '@/signup/components/StepLifestyleProfile';
import type { AdditionalProfile } from '@/constants/additional-profile';

export interface RoommateProfile {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  dormitoryId: string;
  lifestyle: LifestyleData;
  intro: string;
  messageToRoommate: string | null;
  additional: AdditionalProfile;
  matchScore: number;
}

interface UserCardProps {
  profile: RoommateProfile;
  onRequestMatch: () => void;
  onClick?: () => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
}

function getMatchScoreColor(score: number) {
  if (score >= 90) return 'text-green-600 bg-green-100';
  if (score >= 80) return 'text-blue-600 bg-blue-100';
  if (score >= 70) return 'text-orange-600 bg-orange-100';
  return 'text-[var(--knu-text-secondary)] bg-[var(--knu-background-alt)]';
}

export function UserCard({
  profile,
  onRequestMatch,
  onClick,
  disabled,
  onDisabledClick,
}: UserCardProps) {
  const dorm = getDormitoryById(profile.dormitoryId);
  const dormLabel = dorm ? `${dorm.name} ${dorm.roomType}인실` : '';
  const avatarColor = getAvatarColor(profile.nickname);

  const handleMatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      onDisabledClick?.();
    } else {
      onRequestMatch();
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Header: avatar + nickname + dorm badge + match score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text}`}
          >
            {profile.nickname.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--knu-text-primary)]">{profile.nickname}</h3>
            {dormLabel && <p className="text-xs text-[var(--knu-text-tertiary)]">{dormLabel}</p>}
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${getMatchScoreColor(profile.matchScore)}`}
        >
          매칭 {profile.matchScore}%
        </span>
      </div>

      {/* Key lifestyle chips (3 items) with context icons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip
          label={`🚬 ${getLifestyleLabel('smoker', profile.lifestyle.smoker)}`}
          variant="badge"
        />
        <Chip
          label={`🕐 취침 ${getLifestyleLabel('bedtime', profile.lifestyle.bedtime)}`}
          variant="badge"
        />
        <Chip
          label={`✨ ${getLifestyleLabel('cleanliness', profile.lifestyle.cleanliness)}`}
          variant="badge"
        />
        {profile.additional.mbti && (
          <Chip label={`🧠 ${profile.additional.mbti}`} variant="badge" />
        )}
      </div>

      {/* Intro (1-line truncate) */}
      <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed line-clamp-1 mb-3">
        {profile.intro}
      </p>

      {/* Message to Roommate */}
      {profile.messageToRoommate && (
        <div className="flex items-center gap-1.5 mb-3 px-3 py-2 bg-blue-50 rounded-xl">
          <MessageCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700 font-medium line-clamp-1">
            {profile.messageToRoommate}
          </p>
        </div>
      )}

      {/* Match request button */}
      <div className="flex justify-end">
        <button
          onClick={handleMatchClick}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            disabled
              ? 'bg-[var(--knu-primary)] text-white opacity-40 cursor-not-allowed'
              : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
          }`}
        >
          매칭 요청
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
