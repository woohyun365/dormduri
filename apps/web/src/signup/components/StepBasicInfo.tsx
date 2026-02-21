'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { FieldError } from '@/components/form/FieldError';
import { Chip } from '@/components/Chip';
import { validatePassword, validatePasswordConfirm } from '@/utils/validation';
import { User } from 'lucide-react';

export interface BasicInfoData {
  nickname: string;
  password: string;
  passwordConfirm: string;
  gender: 'MALE' | 'FEMALE' | null;
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

  const validateNickname = (value: string) => {
    if (!value) return '닉네임을 입력해주세요.';
    if (value.length < 2) return '닉네임은 2자 이상이어야 합니다.';
    if (value.length > 12) return '닉네임은 12자 이하여야 합니다.';
    return '';
  };

  const handleNext = () => {
    const nicknameErr = validateNickname(basicInfo.nickname);
    const passwordErr = validatePassword(basicInfo.password);
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
          <div className="flex gap-2">
            <Chip
              label="남성"
              selected={basicInfo.gender === 'MALE'}
              onClick={() => {
                onBasicInfoChange({ ...basicInfo, gender: 'MALE' });
                setGenderError('');
              }}
            />
            <Chip
              label="여성"
              selected={basicInfo.gender === 'FEMALE'}
              onClick={() => {
                onBasicInfoChange({ ...basicInfo, gender: 'FEMALE' });
                setGenderError('');
              }}
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
          maxLength={12}
        />

        <InputField
          label="비밀번호"
          type="password"
          placeholder="영문, 숫자 포함 8자 이상"
          value={basicInfo.password}
          onChange={(value) => {
            onBasicInfoChange({ ...basicInfo, password: value });
            setPasswordError('');
          }}
          error={passwordError}
        />

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

      <div className="flex gap-3 pt-4">
        <Button variant="outline" size="lg" fullWidth onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" size="lg" fullWidth onClick={handleNext}>
          다음 단계
        </Button>
      </div>
    </div>
  );
}
