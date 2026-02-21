'use client';

import { useState } from 'react';
import { InputField } from './InputField';
import { Chip } from '@/components/Chip';
import { LandingButton } from '@/landing/components/landing/LandingButton';
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

  const validatePassword = (value: string) => {
    if (!value) return '비밀번호를 입력해주세요.';
    if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) return '비밀번호는 영문과 숫자를 포함해야 합니다.';
    return '';
  };

  const handleNext = () => {
    const nicknameErr = validateNickname(basicInfo.nickname);
    const passwordErr = validatePassword(basicInfo.password);
    let passwordConfirmErr = '';
    let genderErr = '';

    if (basicInfo.password !== basicInfo.passwordConfirm) {
      passwordConfirmErr = '비밀번호가 일치하지 않습니다.';
    }
    if (!basicInfo.gender) {
      genderErr = '성별을 선택해주세요.';
    }

    setNicknameError(nicknameErr);
    setPasswordError(passwordErr);
    setPasswordConfirmError(passwordConfirmErr);
    setGenderError(genderErr);

    if (nicknameErr || passwordErr || passwordConfirmErr || genderErr) return;

    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-[var(--knu-primary)]" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
          기본 정보 입력
        </h2>
        <p className="text-[var(--knu-text-secondary)]">
          서비스 이용을 위한 기본 정보를 입력해주세요
        </p>
      </div>

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
          {genderError && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
              <span className="w-1 h-1 bg-red-600 rounded-full"></span>
              {genderError}
            </p>
          )}
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
        <LandingButton variant="outline" size="lg" fullWidth onClick={onBack}>
          이전
        </LandingButton>
        <LandingButton variant="primary" size="lg" fullWidth onClick={handleNext}>
          다음 단계
        </LandingButton>
      </div>
    </div>
  );
}
