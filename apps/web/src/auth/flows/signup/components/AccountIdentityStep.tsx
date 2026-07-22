'use client';

import { useId, useRef, useState } from 'react';
import { getCollegeCatalog, type CollegeCode } from '@repo/shared/college';
import { profileBirthYearSchema } from '@repo/shared/profile/contract';
import { InputField } from '@/auth/components/form/InputField';
import { StepHeader } from '@/auth/components/StepHeader';
import { StepNavigation } from './StepNavigation';
import { FieldError } from '@/auth/components/form/FieldError';
import { Chip } from '@/components/ui/Chip';
import { validatePasswordConfirm } from '@/auth/model/authFormValidation';
import { validatePasswordStructure as validatePassword } from '@repo/shared/auth/policy';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/auth/model';
import { CAMPUS_OPTIONS } from '../model/campus-options';
import { PasswordRequirementList } from '@/auth/components';
import {
  DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH,
  validateDisplayIdentityNicknameStructure as validateNickname,
} from '@repo/shared/user/identity';
import { User } from 'lucide-react';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { authApi } from '@/auth/api';

import type { Campus } from '@repo/shared/auth';

export interface BasicInfoData {
  nickname: string;
  password: string;
  passwordConfirm: string;
  gender: 'M' | 'F' | null;
  campus: Campus | null;
  collegeCode: CollegeCode | null;
  birthYear: number | null;
}

const MIN_SIGNUP_AGE_YEARS = 18;
const MAX_SIGNUP_AGE_YEARS = 30;

interface AccountIdentityStepProps {
  email: string;
  basicInfo: BasicInfoData;
  onBasicInfoChange: (data: BasicInfoData) => void;
  onNext: (data: BasicInfoData) => void | Promise<void>;
  onBack: () => void;
  nextLabel?: string;
  disabled?: boolean;
}

function hasCollegeInCampus(campus: Campus, collegeCode: CollegeCode | null): boolean {
  if (!collegeCode) return false;
  return getCollegeCatalog(campus).some((college) => college.code === collegeCode);
}

function getSignupBirthYearBounds() {
  const currentYear = new Date().getFullYear();
  return {
    min: currentYear - MAX_SIGNUP_AGE_YEARS,
    max: currentYear - MIN_SIGNUP_AGE_YEARS,
  };
}

function getBirthYearOptions() {
  const { min, max } = getSignupBirthYearBounds();
  return Array.from({ length: max - min + 1 }, (_, index) => max - index);
}

function validateBirthYear(birthYear: number | null): string {
  if (birthYear === null) return '출생연도를 선택해주세요.';
  const { min, max } = getSignupBirthYearBounds();
  const result = profileBirthYearSchema.safeParse(birthYear);
  if (!result.success || birthYear < min || birthYear > max) {
    return `${min}년부터 ${max}년 사이의 출생연도를 선택해주세요.`;
  }
  return '';
}

export function AccountIdentityStep({
  email,
  basicInfo,
  onBasicInfoChange,
  onNext,
  onBack,
  nextLabel = '다음 단계',
  disabled = false,
}: AccountIdentityStepProps) {
  const collegeSelectId = useId();
  const birthYearSelectId = useId();
  const [campusError, setCampusError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  const [genderError, setGenderError] = useState('');
  const [collegeError, setCollegeError] = useState('');
  const [birthYearError, setBirthYearError] = useState('');
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);
  const campusRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const collegeRef = useRef<HTMLSelectElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const birthYearRef = useRef<HTMLSelectElement>(null);

  const collegeOptions = basicInfo.campus ? getCollegeCatalog(basicInfo.campus) : [];
  const birthYearOptions = getBirthYearOptions();

  const handleNext = async () => {
    const campusErr = basicInfo.campus ? '' : '캠퍼스를 선택해주세요.';
    const nicknameFormatErr = validateNickname(basicInfo.nickname);
    const passwordErr = validatePassword(basicInfo.password, email);
    const passwordConfirmErr = validatePasswordConfirm(
      basicInfo.password,
      basicInfo.passwordConfirm,
    );
    const genderErr = basicInfo.gender ? '' : '성별을 선택해주세요.';
    const collegeErr = basicInfo.collegeCode
      ? ''
      : basicInfo.campus && collegeOptions.length === 0
        ? '선택한 캠퍼스에서 이용 가능한 단과대 정보가 없습니다. 춘천캠퍼스를 선택해주세요.'
        : '단과대를 선택해주세요.';
    const birthYearErr = validateBirthYear(basicInfo.birthYear);

    setCampusError(campusErr);
    setPasswordError(passwordErr);
    setPasswordConfirmError(passwordConfirmErr);
    setGenderError(genderErr);
    setCollegeError(collegeErr);
    setBirthYearError(birthYearErr);

    let nextNicknameError = nicknameFormatErr;
    let nextPasswordError = passwordErr;
    let nextEmailError = '';

    if (!nicknameFormatErr) {
      setIsCheckingPolicy(true);
      const validation = await authApi.validateSignupDraft({
        email,
        nickname: basicInfo.nickname,
        password: basicInfo.password,
      });
      setIsCheckingPolicy(false);

      nextNicknameError = validation.fieldErrors?.nickname ?? '';
      nextPasswordError = validation.fieldErrors?.password ?? passwordErr;
      nextEmailError = validation.fieldErrors?.email ?? '';
    }

    setNicknameError(nextNicknameError);
    setPasswordError(nextPasswordError || nextEmailError);

    if (nextNicknameError) {
      focusAndScroll(nicknameRef.current);
      return;
    }
    if (nextPasswordError || nextEmailError) {
      focusAndScroll(passwordRef.current);
      return;
    }
    if (passwordConfirmErr) {
      focusAndScroll(passwordConfirmRef.current);
      return;
    }
    if (campusErr) {
      focusAndScroll(campusRef.current);
      return;
    }
    if (genderErr) {
      focusAndScroll(genderRef.current);
      return;
    }
    if (collegeErr) {
      focusAndScroll(collegeRef.current);
      return;
    }
    if (birthYearErr) {
      focusAndScroll(birthYearRef.current);
      return;
    }

    const nextBasicInfo = { ...basicInfo, nickname: basicInfo.nickname.trim() };
    onBasicInfoChange(nextBasicInfo);
    await onNext(nextBasicInfo);
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<User className="size-8 text-(--knu-primary)" />}
        title="기본 정보 입력"
        description="서비스 이용을 위한 기본 정보를 입력해주세요"
      />

      <div className="bg-(--knu-background-alt) rounded-xl p-4">
        <p className="text-sm text-(--knu-text-secondary)">
          <strong>인증된 이메일:</strong> {email}
        </p>
      </div>

      <div className="space-y-4">
        <div ref={campusRef} tabIndex={-1}>
          <label className="block text-sm font-semibold text-(--knu-text-primary) mb-3">
            캠퍼스 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="캠퍼스 선택">
            {CAMPUS_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={basicInfo.campus === option.value}
                onClick={() => {
                  const nextCollegeCode = hasCollegeInCampus(option.value, basicInfo.collegeCode)
                    ? basicInfo.collegeCode
                    : null;
                  onBasicInfoChange({
                    ...basicInfo,
                    campus: option.value,
                    collegeCode: nextCollegeCode,
                  });
                  setCampusError('');
                  setCollegeError('');
                }}
                role="radio"
                aria-checked={basicInfo.campus === option.value}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-600">
            현재 춘천캠퍼스에서만 매칭 서비스가 운영됩니다
          </p>
          <p className="mt-1 text-xs text-(--knu-text-secondary)">
            본인의 실제 소속 캠퍼스를 선택해주세요 (가입 후 직접 변경 불가)
          </p>
          <FieldError message={campusError} />
        </div>

        <div ref={genderRef} tabIndex={-1}>
          <label className="block text-sm font-semibold text-(--knu-text-primary) mb-3">
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

        <div>
          <label
            htmlFor={collegeSelectId}
            className="block text-sm font-semibold text-(--knu-text-primary) mb-2"
          >
            단과대<span className="text-red-500 ml-1">*</span>
          </label>
          <select
            ref={collegeRef}
            id={collegeSelectId}
            value={basicInfo.collegeCode ?? ''}
            disabled={!basicInfo.campus || collegeOptions.length === 0}
            aria-invalid={!!collegeError}
            onChange={(event) => {
              onBasicInfoChange({
                ...basicInfo,
                collegeCode: event.target.value ? (event.target.value as CollegeCode) : null,
              });
              setCollegeError('');
            }}
            className={`w-full h-12 px-4 rounded-xl border-2 transition-all outline-none ${
              collegeError
                ? 'border-red-300 bg-red-50 focus:border-red-500'
                : 'border-(--knu-border) bg-white focus:border-(--knu-primary)'
            } ${!basicInfo.campus || collegeOptions.length === 0 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
          >
            <option value="">
              {basicInfo.campus ? '단과대를 선택해주세요' : '캠퍼스를 먼저 선택해주세요'}
            </option>
            {collegeOptions.map((college) => (
              <option key={college.code} value={college.code}>
                {college.nameKo}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-(--knu-text-secondary)">
            단과대와 출생연도는 시즌 등록 시 학적 정보로 사용됩니다.
          </p>
          <FieldError message={collegeError} />
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
          maxLength={DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH}
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

        <div>
          <label
            htmlFor={birthYearSelectId}
            className="mb-2 block text-sm font-semibold text-(--knu-text-primary)"
          >
            출생연도<span className="ml-1 text-red-500">*</span>
          </label>
          <select
            ref={birthYearRef}
            id={birthYearSelectId}
            value={basicInfo.birthYear === null ? '' : String(basicInfo.birthYear)}
            aria-invalid={!!birthYearError}
            required
            onChange={(event) => {
              const nextBirthYear = event.target.value === '' ? null : Number(event.target.value);
              onBasicInfoChange({
                ...basicInfo,
                birthYear: Number.isFinite(nextBirthYear) ? nextBirthYear : null,
              });
              setBirthYearError('');
            }}
            className={`h-12 w-full rounded-xl border-2 px-4 outline-none transition-all ${
              birthYearError
                ? 'border-red-300 bg-red-50 focus:border-red-500'
                : 'border-(--knu-border) bg-white focus:border-(--knu-primary)'
            }`}
          >
            <option value="">출생연도를 선택해주세요</option>
            {birthYearOptions.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-(--knu-text-secondary)">
            현재 연도 기준 만 18세부터 만 30세까지 선택할 수 있어요.
          </p>
          <FieldError message={birthYearError} />
        </div>
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        nextLabel={isCheckingPolicy ? '확인 중...' : nextLabel}
        disabled={isCheckingPolicy || disabled}
      />
    </div>
  );
}
