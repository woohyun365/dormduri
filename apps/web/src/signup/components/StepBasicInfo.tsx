'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { StepHeader } from '@/components/StepHeader';
import { StepNavigation } from '@/components/form/StepNavigation';
import { FieldError } from '@/components/form/FieldError';
import { Chip } from '@/components/Chip';
import { validatePassword, validatePasswordConfirm, validateNickname } from '@/utils/validation';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/constants/auth';
import { NICKNAME_MAX } from '@/constants/ui';
import { User } from 'lucide-react';

export interface BasicInfoData {
  nickname: string;
  password: string;
  passwordConfirm: string;
  gender: 'M' | 'F' | null;
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
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  const [genderError, setGenderError] = useState('');

  const handleNext = () => {
    const nicknameErr = validateNickname(basicInfo.nickname);
    const passwordErr = validatePassword(basicInfo.password, email);
    const passwordConfirmErr = validatePasswordConfirm(
      basicInfo.password,
      basicInfo.passwordConfirm,
    );
    const genderErr = basicInfo.gender ? '' : '성별을 선택해주세요.';

    setNicknameError(nicknameErr);
    setPasswordError(passwordErr);
    setPasswordConfirmError(passwordConfirmErr);
    setGenderError(genderErr);

    if (nicknameErr || passwordErr || passwordConfirmErr || genderErr) return;

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
        <div>
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
          label="닉네임"
          type="text"
          placeholder="2-12자 닉네임"
          value={basicInfo.nickname}
          onChange={(value) => {
            onBasicInfoChange({ ...basicInfo, nickname: value });
            setNicknameError('');
          }}
          error={nicknameError}
          helper="다른 사용자에게 보여지는 이름입니다."
          maxLength={NICKNAME_MAX}
        />

        <div>
          <InputField
            label="비밀번호"
            type="password"
            placeholder={`영문, 숫자 포함 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`}
            value={basicInfo.password}
            onChange={(value) => {
              onBasicInfoChange({ ...basicInfo, password: value });
              setPasswordError('');
            }}
            error={passwordError}
          />
          {basicInfo.password.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              <li
                className={
                  basicInfo.password.length >= PASSWORD_MIN_LENGTH
                    ? 'text-green-600'
                    : 'text-[var(--knu-text-tertiary)]'
                }
              >
                {basicInfo.password.length >= PASSWORD_MIN_LENGTH ? '✓' : '○'} {PASSWORD_MIN_LENGTH}
                자 이상
              </li>
              <li
                className={
                  basicInfo.password.length <= PASSWORD_MAX_LENGTH
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {basicInfo.password.length <= PASSWORD_MAX_LENGTH ? '✓' : '✗'} {PASSWORD_MAX_LENGTH}
                자 이하
              </li>
              <li
                className={
                  /[a-zA-Z]/.test(basicInfo.password)
                    ? 'text-green-600'
                    : 'text-[var(--knu-text-tertiary)]'
                }
              >
                {/[a-zA-Z]/.test(basicInfo.password) ? '✓' : '○'} 영문 포함
              </li>
              <li
                className={
                  /\d/.test(basicInfo.password)
                    ? 'text-green-600'
                    : 'text-[var(--knu-text-tertiary)]'
                }
              >
                {/\d/.test(basicInfo.password) ? '✓' : '○'} 숫자 포함
              </li>
              <li
                className={
                  basicInfo.password.toLowerCase() !== email.toLowerCase()
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {basicInfo.password.toLowerCase() !== email.toLowerCase() ? '✓' : '✗'} 이메일과 다름
              </li>
            </ul>
          )}
        </div>

        <InputField
          label="비밀번호 확인"
          type="password"
          placeholder="비밀번호를 다시 입력해주세요"
          value={basicInfo.passwordConfirm}
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
