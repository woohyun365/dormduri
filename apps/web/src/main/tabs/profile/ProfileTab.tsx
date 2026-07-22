'use client';

import { useState } from 'react';
import {
  Building2,
  ChevronRight,
  FileText,
  Shield,
  HelpCircle,
  Mail,
  AlertCircle,
  LogOut,
  Ban,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { SectionHeading } from '@/main/tabs/profile/components/SectionHeading';
import { ComingSoonBadge } from '@/main/tabs/profile/components/ComingSoonBadge';
import { ConfirmDialog } from '@/main/components/overlays/ConfirmDialog';
import { InlineTextEditor } from '@/main/tabs/profile/components/InlineTextEditor';
import { SEASON_PROFILE_INTRO_MAX_LENGTH } from '@repo/shared/season/participation';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import { BuildingSelectModal } from '../../components/BuildingSelectModal';
import { BlockManageSheet } from '../../components/BlockManageSheet';
import { ProfileDetailSheet } from '../../components/profile-detail/ProfileDetailSheet';
import { LifestyleEditSheet } from '../../components/LifestyleEditSheet';
import { ProfilePreviewSection } from './ProfilePreviewSection';
import { ProfileLifestyleSection } from './ProfileLifestyleSection';
import { ProfileAdditionalSection } from './ProfileAdditionalSection';
import type { ProfileAdditional } from '@/main/tabs/profile/model/profileFieldOptions';
import type { LifestyleData } from '@repo/shared/lifestyle';
import { useSeasonContext } from '@/main/contexts/SeasonContext';
import type { UserProfile, RoommateProfile } from '@/main/model/profile';
import type { BlockedUser } from '@/social-safety/model/socialSafety.types';

interface ProfileTabProps {
  user: UserProfile;
  onDormitoryChange: (dormitoryId: string | null) => void;
  onIntroChange: (intro: string) => void;
  onLifestyleChange: (lifestyle: LifestyleData) => void;
  onAdditionalChange: (additional: ProfileAdditional) => void;
  onShowGuide?: () => void;
  blockedUsers?: BlockedUser[];
  onUnblock?: (userId: string, nickname: string) => void;
}

export default function ProfileTab({
  user,
  onDormitoryChange,
  onIntroChange,
  onLifestyleChange,
  onAdditionalChange,
  onShowGuide,
  blockedUsers = [],
  onUnblock,
}: ProfileTabProps) {
  const { isOpen, isMatching } = useSeasonContext();
  const hasRealBuilding = user.dormitoryId !== null;
  const canChangeDormitory = (isOpen || isMatching) && !hasRealBuilding;
  const isProfileLocked = isMatching && hasRealBuilding;
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showLifestyleEdit, setShowLifestyleEdit] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [showBlockManage, setShowBlockManage] = useState(false);

  const dormitory = user.dormitory ?? null;
  const avatarColor = getAvatarColor(user.nickname);

  // Build a RoommateProfile for self-preview
  const selfProfile: RoommateProfile = {
    id: 'self',
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
    dormitoryId: user.dormitoryId,
    dormitory,
    lifestyle: user.lifestyle,
    intro: user.intro,
    messageToRoommate: user.messageToRoommate,
    additional: user.additional,
    matchScore: 100,
  };

  const handleAdditionalField = (field: keyof ProfileAdditional, value: string | null) => {
    const converted = field === 'birthYear' && value !== null ? Number(value) : value;
    onAdditionalChange({ ...user.additional, [field]: converted });
  };

  return (
    <div>
      {showBuildingModal && (
        <BuildingSelectModal
          campus={user.campus}
          gender={user.gender}
          seasonSelectionLocked={isOpen || isMatching}
          onSelect={(id) => {
            onDormitoryChange(id);
            setShowBuildingModal(false);
          }}
          onClose={() => setShowBuildingModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-(--knu-primary) text-white px-5 py-6">
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
                  {canChangeDormitory && (
                    <button
                      onClick={() => setShowBuildingModal(true)}
                      className="text-xs opacity-75 hover:opacity-100 underline transition-opacity"
                    >
                      변경
                    </button>
                  )}
                </div>
              ) : !hasRealBuilding ? (
                <button
                  onClick={canChangeDormitory ? () => setShowBuildingModal(true) : undefined}
                  className={`flex items-center gap-1 text-sm transition-opacity ${
                    canChangeDormitory
                      ? 'opacity-75 hover:opacity-100'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  건물 미배정
                  {canChangeDormitory && <ChevronRight className="w-4 h-4" />}
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
          isLocked={isProfileLocked}
          onEdit={() => setShowLifestyleEdit(true)}
        />

        <ProfileAdditionalSection
          additional={user.additional}
          onFieldChange={handleAdditionalField}
        />

        {/* 자기소개 */}
        <section>
          <SectionHeading
            icon={<FileText className="w-5 h-5 text-(--knu-primary)" />}
            title="자기소개"
          />
          <div className="bg-white rounded-2xl border-2 border-(--knu-border) p-5">
            <InlineTextEditor
              value={user.intro}
              onSave={onIntroChange}
              maxLength={SEASON_PROFILE_INTRO_MAX_LENGTH}
              placeholder="예) 도서관 자주 가고, 방에선 조용히 지내는 편이에요."
            />
          </div>
        </section>

        {/* 계정 */}
        <section>
          <SectionHeading icon={<Shield className="w-5 h-5 text-(--knu-primary)" />} title="계정" />
          <div className="bg-white rounded-2xl border-2 border-(--knu-border) divide-y-2 divide-(--knu-border)">
            <div className="relative p-4 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">
                  비밀번호 변경
                </span>
              </div>
              <ComingSoonBadge />
            </div>
            <div className="relative p-4 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">
                  내 정보 다운로드
                </span>
              </div>
              <ComingSoonBadge />
            </div>
            <button
              onClick={() => setShowBlockManage(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">차단 관리</span>
              </div>
              <div className="flex items-center gap-2">
                {blockedUsers.length > 0 && (
                  <span className="text-xs font-semibold text-(--knu-text-tertiary)">
                    {blockedUsers.length}명
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-(--knu-text-tertiary)" />
              </div>
            </button>
            <button
              onClick={() => setLogoutDialog(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">로그아웃</span>
              </div>
              <ChevronRight className="w-5 h-5 text-(--knu-text-tertiary)" />
            </button>
          </div>
        </section>

        {/* 안내 및 지원 */}
        <section>
          <SectionHeading
            icon={<HelpCircle className="w-5 h-5 text-(--knu-primary)" />}
            title="안내 및 지원"
          />
          <div className="bg-white rounded-2xl border-2 border-(--knu-border) divide-y-2 divide-(--knu-border)">
            {onShowGuide && (
              <button
                onClick={onShowGuide}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-(--knu-text-tertiary)" />
                  <span className="text-sm font-semibold text-(--knu-text-primary)">
                    기숙사 안내 다시 보기
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-(--knu-text-tertiary)" />
              </button>
            )}
            <Link
              href="/terms"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">이용약관</span>
              </div>
              <ChevronRight className="w-5 h-5 text-(--knu-text-tertiary)" />
            </Link>
            <Link
              href="/privacy"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">
                  개인정보처리방침
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-(--knu-text-tertiary)" />
            </Link>
            <a
              href="mailto:woohyun365@gmail.com"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-(--knu-text-tertiary)" />
                <span className="text-sm font-semibold text-(--knu-text-primary)">문의하기</span>
              </div>
              <ChevronRight className="w-5 h-5 text-(--knu-text-tertiary)" />
            </a>
          </div>
        </section>

        {/* 앱 정보 */}
        <section>
          <h2 className="font-bold text-(--knu-text-primary) mb-3">앱 정보</h2>
          <div className="bg-white rounded-2xl border-2 border-(--knu-border) p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-(--knu-text-tertiary)">버전</span>
              <span className="text-sm font-semibold text-(--knu-text-primary)">1.0.0</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-(--knu-text-tertiary)">최근 업데이트</span>
              <span className="text-sm font-semibold text-(--knu-text-primary)">2026.03.06</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-(--knu-text-tertiary)">개발자</span>
              <span className="text-sm font-semibold text-(--knu-text-primary)">이우현</span>
            </div>
          </div>
        </section>

        {/* 위험 영역 */}
        <section>
          <SectionHeading
            icon={<AlertCircle className="w-5 h-5" />}
            title="위험 영역"
            variant="danger"
          />
          <div className="bg-white rounded-2xl border-2 border-red-200 p-5">
            <div className="mb-4">
              <h3 className="font-bold text-(--knu-text-primary) mb-2">계정 삭제</h3>
              <p className="text-sm text-(--knu-text-secondary) mb-4">
                계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
              </p>
            </div>
            <button
              onClick={() => setDeleteDialog(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              계정 삭제하기
            </button>
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
        isLocked={isProfileLocked}
      />

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        isOpen={logoutDialog}
        onClose={() => setLogoutDialog(false)}
        onConfirm={async () => {
          const { authApi } = await import('@/auth/api');
          await authApi.logout();
          window.location.replace('/');
        }}
        title="로그아웃"
        message="로그아웃 하시겠습니까?"
        confirmLabel="로그아웃"
      />

      {/* Delete Account Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => {
          window.location.replace('/');
        }}
        title="계정 삭제"
        message="정말로 계정을 삭제하시겠습니까?\n\n모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다."
        confirmLabel="삭제하기"
        variant="danger"
      />

      {/* Block Manage Sheet */}
      <BlockManageSheet
        isOpen={showBlockManage}
        onClose={() => setShowBlockManage(false)}
        blockedUsers={blockedUsers}
        onUnblock={(userId, nickname) => onUnblock?.(userId, nickname)}
      />
    </div>
  );
}
