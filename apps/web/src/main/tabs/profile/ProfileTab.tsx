'use client';

import { useState } from 'react';
import { Building2, ChevronRight, FileText, MessageCircle } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
import { InlineTextEditor } from '@/components/form/InlineTextEditor';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import { INTRO_MAX_LENGTH, MESSAGE_MAX_LENGTH } from '@/constants/ui';
import { getAvatarColor } from '@/utils/avatarColor';
import { BuildingSelectModal } from '../../components/BuildingSelectModal';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import { LifestyleEditSheet } from '../../components/LifestyleEditSheet';
import { ProfilePreviewSection } from './ProfilePreviewSection';
import { ProfileLifestyleSection } from './ProfileLifestyleSection';
import { ProfileAdditionalSection } from './ProfileAdditionalSection';
import type { AdditionalProfile } from '@/types/additional-profile';
import type { LifestyleData } from '@/types/lifestyle';
import type { UserProfile, RoommateProfile } from '@/types/profile';

interface ProfileTabProps {
  user: UserProfile;
  onDormitoryChange: (dormitoryId: string) => void;
  onIntroChange: (intro: string) => void;
  onMessageChange: (message: string | null) => void;
  onLifestyleChange: (lifestyle: LifestyleData) => void;
  onAdditionalChange: (additional: AdditionalProfile) => void;
}

export default function ProfileTab({
  user,
  onDormitoryChange,
  onIntroChange,
  onMessageChange,
  onLifestyleChange,
  onAdditionalChange,
}: ProfileTabProps) {
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showLifestyleEdit, setShowLifestyleEdit] = useState(false);

  const isUnassigned = user.dormitoryId === UNASSIGNED_ID;
  const dormitory = user.dormitoryId && !isUnassigned ? getDormitoryById(user.dormitoryId) : null;
  const avatarColor = getAvatarColor(user.nickname);

  // Build a RoommateProfile for self-preview
  const selfProfile: RoommateProfile = {
    id: 'self',
    nickname: user.nickname,
    gender: user.gender,
    dormitoryId: user.dormitoryId,
    lifestyle: user.lifestyle,
    intro: user.intro,
    messageToRoommate: user.messageToRoommate,
    additional: user.additional,
    matchScore: 100,
  };

  const handleAdditionalField = (field: keyof AdditionalProfile, value: string | null) => {
    onAdditionalChange({ ...user.additional, [field]: value });
  };

  return (
    <div>
      {showBuildingModal && (
        <BuildingSelectModal
          gender={user.gender}
          onSelect={(id) => {
            onDormitoryChange(id);
            setShowBuildingModal(false);
          }}
          onClose={() => setShowBuildingModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-[var(--knu-primary)] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">내 프로필</h1>
          <div className="flex items-center gap-4">
            <div
              className={`w-20 h-20 ${avatarColor.bg} rounded-2xl flex items-center justify-center text-3xl font-bold ${avatarColor.text}`}
            >
              {user.nickname.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{user.nickname}</h2>
                <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full">
                  {user.gender === 'M' ? '남' : '여'}
                </span>
              </div>
              {dormitory ? (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 opacity-90" />
                  <span className="text-sm opacity-90">
                    {dormitory.name} · {dormitory.roomType}인실
                  </span>
                  <button
                    onClick={() => setShowBuildingModal(true)}
                    className="text-xs opacity-75 hover:opacity-100 underline transition-opacity"
                  >
                    변경
                  </button>
                </div>
              ) : isUnassigned ? (
                <button
                  onClick={() => setShowBuildingModal(true)}
                  className="flex items-center gap-1 text-sm opacity-75 hover:opacity-100 transition-opacity"
                >
                  <Building2 className="w-4 h-4" />
                  건물 미배정
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        <ProfilePreviewSection
          user={user}
          dormitory={dormitory ?? null}
          avatarColor={avatarColor}
          onShowDetail={() => setShowDetailSheet(true)}
        />

        <ProfileLifestyleSection
          lifestyle={user.lifestyle}
          onEdit={() => setShowLifestyleEdit(true)}
        />

        <ProfileAdditionalSection
          additional={user.additional}
          onFieldChange={handleAdditionalField}
        />

        {/* 자기소개 */}
        <section>
          <SectionHeading
            icon={<FileText className="w-5 h-5 text-[var(--knu-primary)]" />}
            title="자기소개"
          />
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
            <InlineTextEditor
              value={user.intro}
              onSave={onIntroChange}
              maxLength={INTRO_MAX_LENGTH}
              placeholder="예) 도서관 자주 가고, 방에선 조용히 지내는 편이에요."
            />
          </div>
        </section>

        {/* 룸메에게 한마디 */}
        <section>
          <SectionHeading
            icon={<MessageCircle className="w-5 h-5 text-[var(--knu-primary)]" />}
            title="룸메에게 한마디"
          />
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
            <InlineTextEditor
              value={user.messageToRoommate ?? ''}
              onSave={(val) => onMessageChange(val || null)}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder="공용물품, 가져갈 것 등 룸메에게 전할 메시지를 남겨보세요"
              rows={2}
              allowEmpty
            />
          </div>
        </section>

        <div className="h-8" />
      </div>

      {/* Profile Detail Sheet (self-preview) */}
      <ProfileDetailSheet
        profile={selfProfile}
        isOpen={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        onRequestMatch={() => {}}
        hideMatchButton
      />

      {/* Lifestyle Edit Sheet */}
      <LifestyleEditSheet
        isOpen={showLifestyleEdit}
        onClose={() => setShowLifestyleEdit(false)}
        lifestyle={user.lifestyle}
        onSave={onLifestyleChange}
      />
    </div>
  );
}
