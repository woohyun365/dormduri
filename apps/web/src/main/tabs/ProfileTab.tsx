'use client';

import { useState } from 'react';
import {
  Building2,
  Cigarette,
  Moon,
  Sun,
  Coffee,
  Volume2,
  Sparkles,
  Heart,
  MessageCircle,
  FileText,
  ChevronRight,
  Eye,
  Edit2,
  GraduationCap,
  Thermometer,
} from 'lucide-react';
import { Chip } from '@/components/Chip';
import { SectionHeading } from '@/components/SectionHeading';
import { InlineTextEditor } from '@/components/form/InlineTextEditor';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import { getLifestyleLabel } from '@/constants/lifestyle';
import { LifestyleChipSummary } from '../components/LifestyleChipSummary';
import { INTRO_MAX_LENGTH, MESSAGE_MAX_LENGTH } from '@/constants/ui';
import { getAvatarColor } from '@/utils/avatarColor';
import { BuildingSelectModal } from '../components/BuildingSelectModal';
import { ProfileDetailSheet } from '../components/ProfileDetailSheet';
import { LifestyleEditSheet } from '../components/LifestyleEditSheet';
import {
  COLLEGES,
  GRADES,
  MBTI_DIMENSIONS,
  TEMPERATURE_SENSITIVITY,
  ADDITIONAL_FIELD_NAMES,
} from '@/constants/additional-profile';
import type { AdditionalProfile } from '@/constants/additional-profile';
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

/* ── MBTI Selector ── */
function MBTISelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (mbti: string | null) => void;
}) {
  // 로컬 draft로 중간 상태(1~3글자) 유지 — 부모에는 4글자 완성 시에만 전달
  const [draft, setDraft] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? '');
  }

  const sortMBTI = (s: string) => {
    const order = 'EISNTFJP';
    return s
      .split('')
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .join('');
  };

  const handleToggle = (dim: (typeof MBTI_DIMENSIONS)[number], opt: string) => {
    const other = dim.options.find((o) => o !== opt)!;
    let next = draft;
    if (draft.includes(opt)) {
      // 이미 선택된 글자 클릭 → 같은 차원의 반대 옵션으로 전환
      next = next.replace(opt, other);
    } else {
      next = next.replace(other, '') + opt;
    }
    const sorted = sortMBTI(next);
    setDraft(sorted);
    onChange(sorted.length === 4 ? sorted : null);
  };

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
        {ADDITIONAL_FIELD_NAMES.mbti}
      </p>
      <div className="flex gap-2">
        {MBTI_DIMENSIONS.map((dim) => (
          <div key={dim.key} className="flex flex-1 gap-1">
            {dim.options.map((opt) => {
              const isSelected = draft.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleToggle(dim, opt)}
                  className={`flex-1 h-9 sm:h-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-[var(--knu-primary)] text-white'
                      : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {draft.length > 0 && (
        <div className="flex items-center justify-between mt-2">
          <p
            className={`text-sm font-semibold ${draft.length === 4 ? 'text-[var(--knu-primary)]' : 'text-orange-600'}`}
          >
            {draft}
            {draft.length < 4 && ` · ${4 - draft.length}개 더 선택해주세요`}
          </p>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onChange(null);
            }}
            className="text-xs text-[var(--knu-text-tertiary)] hover:text-red-500 transition-colors"
          >
            초기화
          </button>
        </div>
      )}
    </div>
  );
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
        {/* 내 카드 미리보기 */}
        <section>
          <SectionHeading
            icon={<Eye className="w-5 h-5 text-[var(--knu-primary)]" />}
            title="다른 사람에게 보이는 내 카드"
          />
          <button
            type="button"
            onClick={() => setShowDetailSheet(true)}
            className="cursor-pointer w-full text-left"
          >
            <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text}`}
                  >
                    {user.nickname.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--knu-text-primary)]">
                      {user.nickname}
                    </h3>
                    {dormitory && (
                      <p className="text-xs text-[var(--knu-text-tertiary)]">
                        {dormitory.name} {dormitory.roomType}인실
                      </p>
                    )}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-green-600 bg-green-100">
                  매칭 100%
                </span>
              </div>
              <div className="mb-3">
                <LifestyleChipSummary lifestyle={user.lifestyle} />
              </div>
              <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed line-clamp-1 mb-3">
                {user.intro}
              </p>
              {user.messageToRoommate && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-xl">
                  <MessageCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700 font-medium line-clamp-1">
                    {user.messageToRoommate}
                  </p>
                </div>
              )}
            </div>
          </button>
        </section>

        {/* 생활패턴 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading
              icon={<Sparkles className="w-5 h-5 text-[var(--knu-primary)]" />}
              title="생활패턴 프로필"
            />
            <button
              onClick={() => setShowLifestyleEdit(true)}
              className="flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
            >
              <Edit2 className="w-4 h-4" />
              수정
            </button>
          </div>
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
            <div className="grid grid-cols-2 gap-4">
              <GridItem
                icon={<Cigarette className="w-4 h-4 text-red-600" />}
                bg="bg-red-100"
                label="흡연 여부"
                value={getLifestyleLabel('smoker', user.lifestyle.smoker)}
              />
              <GridItem
                icon={<Moon className="w-4 h-4 text-indigo-600" />}
                bg="bg-indigo-100"
                label="잠버릇"
                value={getLifestyleLabel('sleepHabit', user.lifestyle.sleepHabit)}
              />
              <GridItem
                icon={<Coffee className="w-4 h-4 text-yellow-600" />}
                bg="bg-yellow-100"
                label="실내 취식"
                value={getLifestyleLabel('indoorEating', user.lifestyle.indoorEating)}
              />
              <GridItem
                icon={<Moon className="w-4 h-4 text-blue-600" />}
                bg="bg-blue-100"
                label="취침 시간"
                value={getLifestyleLabel('bedtime', user.lifestyle.bedtime)}
              />
              <GridItem
                icon={<Sun className="w-4 h-4 text-orange-600" />}
                bg="bg-orange-100"
                label="기상 시간"
                value={getLifestyleLabel('wakeTime', user.lifestyle.wakeTime)}
              />
              <GridItem
                icon={<Volume2 className="w-4 h-4 text-purple-600" />}
                bg="bg-purple-100"
                label="소음 민감도"
                value={getLifestyleLabel('noiseSensitivity', user.lifestyle.noiseSensitivity)}
              />
              <GridItem
                icon={<Sparkles className="w-4 h-4 text-green-600" />}
                bg="bg-green-100"
                label="청결도"
                value={getLifestyleLabel('cleanliness', user.lifestyle.cleanliness)}
              />
              <GridItem
                icon={<Heart className="w-4 h-4 text-pink-600" />}
                bg="bg-pink-100"
                label="관계 성향"
                value={getLifestyleLabel('relationshipStyle', user.lifestyle.relationshipStyle)}
              />
            </div>
          </div>
        </section>

        {/* 추가 정보 */}
        <section>
          <SectionHeading
            icon={<GraduationCap className="w-5 h-5 text-[var(--knu-primary)]" />}
            title="추가 정보"
            suffix="(선택)"
          />
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 space-y-5">
            {/* 단대 */}
            <div>
              <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
                {ADDITIONAL_FIELD_NAMES.college}
                <span
                  className={`ml-2 font-normal ${user.additional.college ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
                >
                  {user.additional.college ?? '-'}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {COLLEGES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={user.additional.college === c}
                    onClick={() =>
                      handleAdditionalField('college', user.additional.college === c ? null : c)
                    }
                  />
                ))}
              </div>
            </div>

            {/* 학년 */}
            <div>
              <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
                {ADDITIONAL_FIELD_NAMES.grade}
                <span
                  className={`ml-2 font-normal ${user.additional.grade ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
                >
                  {GRADES.find((g) => g.value === user.additional.grade)?.label ?? '-'}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {GRADES.map((g) => (
                  <Chip
                    key={g.value}
                    label={g.label}
                    selected={user.additional.grade === g.value}
                    onClick={() =>
                      handleAdditionalField(
                        'grade',
                        user.additional.grade === g.value ? null : g.value,
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {/* MBTI */}
            <MBTISelector
              value={user.additional.mbti}
              onChange={(mbti) => handleAdditionalField('mbti', mbti)}
            />

            {/* 온도 민감도 */}
            <div>
              <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
                {ADDITIONAL_FIELD_NAMES.temperatureSensitivity}
                <span
                  className={`font-normal ${user.additional.temperatureSensitivity ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
                >
                  {TEMPERATURE_SENSITIVITY.find(
                    (t) => t.value === user.additional.temperatureSensitivity,
                  )?.label ?? '-'}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPERATURE_SENSITIVITY.map((t) => (
                  <Chip
                    key={t.value}
                    label={t.label}
                    selected={user.additional.temperatureSensitivity === t.value}
                    onClick={() =>
                      handleAdditionalField(
                        'temperatureSensitivity',
                        user.additional.temperatureSensitivity === t.value ? null : t.value,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

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

function GridItem({
  icon,
  bg,
  label,
  value,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--knu-text-tertiary)]">{label}</p>
        <p
          className={`text-sm font-semibold truncate ${value === '미입력' ? 'text-[var(--knu-text-tertiary)]' : 'text-[var(--knu-text-primary)]'}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
