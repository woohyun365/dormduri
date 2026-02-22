'use client';

import { useEffect } from 'react';
import { X, ChevronRight, MessageCircle } from 'lucide-react';
import { LIFESTYLE_FIELD_NAMES, getLifestyleLabel } from '@/constants/lifestyle';
import { getDormitoryById } from '@/constants/dormitory';
import {
  ADDITIONAL_FIELD_NAMES,
  GRADES,
  TEMPERATURE_SENSITIVITY,
} from '@/constants/additional-profile';
import { getAvatarColor } from '../utils/avatarColor';
import type { RoommateProfile } from './UserCard';
import type { LifestyleData } from '@/signup/components/StepLifestyleProfile';

interface ProfileDetailSheetProps {
  profile: RoommateProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestMatch: () => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
  hideMatchButton?: boolean;
}

function getMatchScoreColor(score: number) {
  if (score >= 90) return 'text-green-600 bg-green-100';
  if (score >= 80) return 'text-blue-600 bg-blue-100';
  if (score >= 70) return 'text-orange-600 bg-orange-100';
  return 'text-[var(--knu-text-secondary)] bg-[var(--knu-background-alt)]';
}

const LIFESTYLE_FIELDS = Object.keys(LIFESTYLE_FIELD_NAMES) as (keyof LifestyleData)[];

export function ProfileDetailSheet({
  profile,
  isOpen,
  onClose,
  onRequestMatch,
  disabled,
  onDisabledClick,
  hideMatchButton,
}: ProfileDetailSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !profile) return null;

  const dorm = getDormitoryById(profile.dormitoryId);
  const dormLabel = dorm ? `${dorm.name} ${dorm.roomType}인실` : '';
  const avatarColor = getAvatarColor(profile.nickname);

  const handleMatchClick = () => {
    if (disabled) {
      onDisabledClick?.();
    } else {
      onRequestMatch();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--knu-border)] px-5 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--knu-text-primary)]">프로필</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--knu-background-alt)] transition-colors"
          >
            <X className="w-6 h-6 text-[var(--knu-text-secondary)]" />
          </button>
        </div>

        <div className="p-5 pb-5 space-y-5">
          {/* Avatar + Nickname + Dorm + Match */}
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 ${avatarColor.bg} rounded-full flex items-center justify-center text-2xl font-bold ${avatarColor.text}`}
            >
              {profile.nickname.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">
                {profile.nickname}
              </h3>
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
            <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed">
              {profile.intro}
            </p>
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

        {/* Sticky Bottom Button */}
        {!hideMatchButton && (
          <div className="sticky bottom-0 bg-white border-t border-[var(--knu-border)] p-5">
            <button
              onClick={handleMatchClick}
              className={`w-full flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                disabled
                  ? 'bg-[var(--knu-primary)] text-white opacity-40 cursor-not-allowed'
                  : 'bg-[var(--knu-primary)] text-white hover:bg-[var(--knu-primary-hover)]'
              }`}
            >
              매칭 요청
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
