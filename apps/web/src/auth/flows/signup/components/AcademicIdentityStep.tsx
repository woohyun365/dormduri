import { useEffect, useRef, useState } from 'react';
import { AlertCircle, GraduationCap, Info } from 'lucide-react';
import { getCollegeCatalog } from '@repo/shared/college';
import { profileBirthYearSchema } from '@repo/shared/profile/contract';
import { StepHeader } from '@/auth/components/StepHeader';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import type { SignupAccountData } from '../model/signup-account.types';
import { SIGNUP_ACADEMIC_COPY } from '../model/signup-academic-copy';
import { AccountAcademicIdentitySection } from './account-identity/AccountAcademicIdentitySection';
import { StepNavigation } from './StepNavigation';

const MIN_SIGNUP_AGE_YEARS = 18;
const MAX_SIGNUP_AGE_YEARS = 30;

interface AcademicIdentityStepProps {
  accountData: SignupAccountData;
  onAccountDataChange: (data: SignupAccountData) => void;
  onNext: (data: SignupAccountData) => void | Promise<void>;
  onBack: () => void;
  nextLabel?: string;
  disabled?: boolean;
  submissionError?: string;
  serverFieldErrors?: Partial<Record<'campus' | 'gender' | 'collegeCode' | 'birthYear', string>>;
  onServerErrorClear?: () => void;
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

export function AcademicIdentityStep({
  accountData,
  onAccountDataChange,
  onNext,
  onBack,
  nextLabel = '가입하기',
  disabled = false,
  submissionError,
  serverFieldErrors,
  onServerErrorClear,
}: AcademicIdentityStepProps) {
  const [campusError, setCampusError] = useState('');
  const [genderError, setGenderError] = useState('');
  const [collegeError, setCollegeError] = useState('');
  const [birthYearError, setBirthYearError] = useState('');
  const campusRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const collegeRef = useRef<HTMLSelectElement>(null);
  const birthYearRef = useRef<HTMLSelectElement>(null);

  const birthYearOptions = getBirthYearOptions();
  const displayedCampusError = campusError || serverFieldErrors?.campus || '';
  const displayedGenderError = genderError || serverFieldErrors?.gender || '';
  const displayedCollegeError = collegeError || serverFieldErrors?.collegeCode || '';
  const displayedBirthYearError = birthYearError || serverFieldErrors?.birthYear || '';

  useEffect(() => {
    const recoveryTarget = serverFieldErrors?.campus
      ? campusRef.current
      : serverFieldErrors?.gender
        ? genderRef.current
        : serverFieldErrors?.collegeCode
          ? collegeRef.current
          : serverFieldErrors?.birthYear
            ? birthYearRef.current
            : null;
    if (recoveryTarget) focusAndScroll(recoveryTarget);
  }, [
    serverFieldErrors?.birthYear,
    serverFieldErrors?.campus,
    serverFieldErrors?.collegeCode,
    serverFieldErrors?.gender,
  ]);

  const handleNext = async () => {
    const collegeOptions = accountData.campus ? getCollegeCatalog(accountData.campus) : [];
    const campusValidationError = accountData.campus ? '' : '캠퍼스를 선택해주세요.';
    const genderValidationError = accountData.gender ? '' : '성별을 선택해주세요.';
    const collegeValidationError = accountData.collegeCode
      ? ''
      : accountData.campus && collegeOptions.length === 0
        ? SIGNUP_ACADEMIC_COPY.collegeCatalogUnavailable
        : '단과대를 선택해주세요.';
    const birthYearValidationError = validateBirthYear(accountData.birthYear);

    setCampusError(campusValidationError);
    setGenderError(genderValidationError);
    setCollegeError(collegeValidationError);
    setBirthYearError(birthYearValidationError);

    if (campusValidationError) {
      focusAndScroll(campusRef.current);
      return;
    }
    if (genderValidationError) {
      focusAndScroll(genderRef.current);
      return;
    }
    if (collegeValidationError) {
      focusAndScroll(collegeRef.current);
      return;
    }
    if (birthYearValidationError) {
      focusAndScroll(birthYearRef.current);
      return;
    }

    onAccountDataChange(accountData);
    await onNext(accountData);
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<GraduationCap className="size-8 text-(--knu-primary)" />}
        title="기본 정보를 확인해요"
        description="학교와 기본 정보를 선택해요."
      />

      <div className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="whitespace-nowrap text-xs leading-5">
          {SIGNUP_ACADEMIC_COPY.immutableIdentity}
        </p>
      </div>

      <AccountAcademicIdentitySection
        basicInfo={accountData}
        campusError={displayedCampusError}
        genderError={displayedGenderError}
        collegeError={displayedCollegeError}
        birthYearError={displayedBirthYearError}
        birthYearOptions={birthYearOptions}
        campusRef={campusRef}
        genderRef={genderRef}
        collegeRef={collegeRef}
        birthYearRef={birthYearRef}
        disabled={disabled}
        onBasicInfoChange={onAccountDataChange}
        onCampusErrorClear={() => {
          setCampusError('');
          onServerErrorClear?.();
        }}
        onGenderErrorClear={() => {
          setGenderError('');
          onServerErrorClear?.();
        }}
        onCollegeErrorClear={() => {
          setCollegeError('');
          onServerErrorClear?.();
        }}
        onBirthYearErrorClear={() => {
          setBirthYearError('');
          onServerErrorClear?.();
        }}
      />

      {submissionError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-5">{submissionError}</p>
        </div>
      )}

      <StepNavigation
        onBack={onBack}
        onNext={handleNext}
        nextLabel={nextLabel}
        disabled={disabled}
      />
    </div>
  );
}
