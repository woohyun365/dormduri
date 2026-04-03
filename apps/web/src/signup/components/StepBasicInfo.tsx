'use client';

import { useRef, useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { FieldError } from '@/components/form/FieldError';
import { Chip } from '@/components/Chip';
import { validatePassword, validatePasswordConfirm, validateNickname } from '@/utils/validation';
import { CAMPUS_OPTIONS, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/constants/auth';
import { PasswordRequirementList } from '@/components/auth/PasswordRequirementList';
import { NICKNAME_MAX } from '@/constants/ui';
import { User } from 'lucide-react';
import { focusAndScroll } from '@/utils/focus';

import type { Campus } from '@/types/profile';

export interface BasicInfoData {
  nickname: string;
  password: string;
  passwordConfirm: string;
  gender: 'M' | 'F' | null;
  campus: Campus | null;
}

interface StepBasicInfoProps {
  email: string;
  basicInfo: BasicInfoData;
  onBasicInfoChange: (data: BasicInfoData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBasicInfo({
  email,
  basicInfo,
  onBasicInfoChange,
  onNext,
  onBack,
}: StepBasicInfoProps) {
  const [campusError, setCampusError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  const [genderError, setGenderError] = useState('');
  const campusRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const handleNext = () => {
    const campusErr = basicInfo.campus ? '' : '캠퍼스를 선택해주세요.';
    const nicknameErr = validateNickname(basicInfo.nickname);
    const passwordErr = validatePassword(basicInfo.password, email);
    const passwordConfirmErr = validatePasswordConfirm(
      basicInfo.password,
      basicInfo.passwordConfirm,
    );
    const genderErr = basicInfo.gender ? '' : '성별을 선택해주세요.';

    setCampusError(campusErr);
    setNicknameError(nicknameErr);
    setPasswordError(passwordErr);
    setPasswordConfirmError(passwordConfirmErr);
    setGenderError(genderErr);

    if (campusErr) {
      focusAndScroll(campusRef.current);
      return;
    }
    if (genderErr) {
      focusAndScroll(genderRef.current);
      return;
    }
    if (nicknameErr) {
      focusAndScroll(nicknameRef.current);
      return;
    }
    if (passwordErr) {
      focusAndScroll(passwordRef.current);
      return;
    }
    if (passwordConfirmErr) {
      focusAndScroll(passwordConfirmRef.current);
      return;
    }

    onBasicInfoChange({ ...basicInfo, nickname: basicInfo.nickname.trim() });
    onNext();
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<User className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="기본 정보 입력"
        description="서비스 이용을 위한 기본 정보를 입력해주세요"
      />

      <div className="bg-[var(--knu-background-alt)] rounded-xl p-4">
        <p className="text-sm text-[var(--knu-text-secondary)]">
          <strong>인증된 이메일:</strong> {email}
        </p>
      </div>

      <div className="space-y-4">
        <div ref={campusRef} tabIndex={-1}>
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            캠퍼스 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="캠퍼스 선택">
            {CAMPUS_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={basicInfo.campus === option.value}
                onClick={() => {
                  onBasicInfoChange({ ...basicInfo, campus: option.value });
                  setCampusError('');
                }}
                role="radio"
                aria-checked={basicInfo.campus === option.value}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-600">
            현재 춘천캠퍼스에서만 매칭 서비스가 운영됩니다
          </p>
          <p className="mt-1 text-xs text-[var(--knu-text-secondary)]">
            본인의 실제 소속 캠퍼스를 선택해주세요 (가입 후 직접 변경 불가)
          </p>
          <FieldError message={campusError} />
        </div>

        <div ref={genderRef} tabIndex={-1}>
          <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
            성별 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="성별 선택">
            <Chip
              label="남성"
              selected={basicInfo.gender === 'M'}
              onClick={() => {
                onBasicInfoChange({ ...basicInfo, gender: 'M' });
                setGenderError('');
              }}
              role="radio"
              aria-checked={basicInfo.gender === 'M'}
            />
            <Chip
              label="여성"
              selected={basicInfo.gender === 'F'}
              onClick={() => {
                onBasicInfoChange({ ...basicInfo, gender: 'F' });
                setGenderError('');
              }}
              role="radio"
              aria-checked={basicInfo.gender === 'F'}
            />
          </div>
          <FieldError message={genderError} />
        </div>

        <InputField
          ref={nicknameRef}
          label="닉네임"
          type="text"
          placeholder="한글, 영문, 숫자 2~8자"
          value={basicInfo.nickname}
          onChange={(value) => {
            onBasicInfoChange({ ...basicInfo, nickname: value });
            setNicknameError('');
          }}
          error={nicknameError}
          helper="다른 사용자에게 보여지는 이름입니다."
          maxLength={NICKNAME_MAX}
          required
        />

        <div>
          <InputField
            ref={passwordRef}
            label="비밀번호"
            type="password"
            placeholder={`영문, 숫자 포함 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`}
            value={basicInfo.password}
            onChange={(value) => {
              onBasicInfoChange({ ...basicInfo, password: value });
              setPasswordError('');
            }}
            error={passwordError}
            required
          />
          <PasswordRequirementList password={basicInfo.password} email={email} />
        </div>

        <InputField
          ref={passwordConfirmRef}
          label="비밀번호 확인"
          type="password"
          placeholder="비밀번호를 다시 입력해주세요"
          value={basicInfo.passwordConfirm}
          required
          onChange={(value) => {
            onBasicInfoChange({ ...basicInfo, passwordConfirm: value });
            setPasswordConfirmError('');
          }}
          error={passwordConfirmError}
        />
      </div>

      <StepNavigation onBack={onBack} onNext={handleNext} />
    </div>
  );
}
