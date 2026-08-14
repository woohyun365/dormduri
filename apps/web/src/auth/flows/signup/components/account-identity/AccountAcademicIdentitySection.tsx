import { useId, type RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  getCollegeCatalog,
  isCollegeAvailableForCampus,
  type CollegeCode,
} from '@repo/shared/college';
import { Field, FieldDescription, FieldLabel, FieldMessage } from '@/auth/components/form/Field';
import { Chip } from '@/components/ui/Chip';
import { CAMPUS_OPTIONS } from '../../model/campus-options';
import {
  getSignupCampusMatchingCopy,
  SIGNUP_ACADEMIC_COPY,
} from '../../model/signup-academic-copy';
import type { SignupAccountData } from '../../model/signup-account.types';

interface AccountAcademicIdentitySectionProps {
  basicInfo: SignupAccountData;
  campusError: string;
  genderError: string;
  collegeError: string;
  birthYearError: string;
  birthYearOptions: number[];
  campusRef: RefObject<HTMLDivElement | null>;
  genderRef: RefObject<HTMLDivElement | null>;
  collegeRef: RefObject<HTMLSelectElement | null>;
  birthYearRef: RefObject<HTMLSelectElement | null>;
  disabled: boolean;
  onBasicInfoChange: (data: SignupAccountData) => void;
  onCampusErrorClear: () => void;
  onGenderErrorClear: () => void;
  onCollegeErrorClear: () => void;
  onBirthYearErrorClear: () => void;
}

export function AccountAcademicIdentitySection({
  basicInfo,
  campusError,
  genderError,
  collegeError,
  birthYearError,
  birthYearOptions,
  campusRef,
  genderRef,
  collegeRef,
  birthYearRef,
  disabled,
  onBasicInfoChange,
  onCampusErrorClear,
  onGenderErrorClear,
  onCollegeErrorClear,
  onBirthYearErrorClear,
}: AccountAcademicIdentitySectionProps) {
  const campusLabelId = useId();
  const campusErrorId = useId();
  const genderLabelId = useId();
  const genderErrorId = useId();
  const collegeSelectId = useId();
  const collegeErrorId = useId();
  const birthYearSelectId = useId();
  const birthYearErrorId = useId();
  const collegeOptions = basicInfo.campus ? getCollegeCatalog(basicInfo.campus) : [];
  const campusMatchingCopy = basicInfo.campus
    ? getSignupCampusMatchingCopy(basicInfo.campus)
    : SIGNUP_ACADEMIC_COPY.campusUnselected;

  return (
    <section aria-label="학교·기본 정보 입력" className="space-y-4">
      <Field ref={campusRef} tabIndex={-1} invalid={Boolean(campusError)}>
        <FieldLabel
          id={campusLabelId}
          className="mb-3 block text-sm font-semibold text-(--knu-text-primary)"
        >
          캠퍼스 <span className="text-red-500">*</span>
        </FieldLabel>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby={campusLabelId}
          aria-describedby={campusError ? campusErrorId : undefined}
        >
          {CAMPUS_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={basicInfo.campus === option.value}
              disabled={disabled}
              onClick={() => {
                const nextCollegeCode =
                  basicInfo.collegeCode &&
                  isCollegeAvailableForCampus(option.value, basicInfo.collegeCode)
                    ? basicInfo.collegeCode
                    : null;
                onBasicInfoChange({
                  ...basicInfo,
                  campus: option.value,
                  collegeCode: nextCollegeCode,
                });
                onCampusErrorClear();
                onCollegeErrorClear();
              }}
              role="radio"
              aria-checked={basicInfo.campus === option.value}
            />
          ))}
        </div>
        <FieldDescription
          className={`mt-2 text-xs ${
            basicInfo.campus ? 'font-medium text-amber-700' : 'text-slate-500'
          }`}
        >
          {campusMatchingCopy}
        </FieldDescription>
        <FieldMessage error={campusError} errorId={campusErrorId} />
      </Field>

      <Field ref={genderRef} tabIndex={-1} invalid={Boolean(genderError)}>
        <FieldLabel
          id={genderLabelId}
          className="mb-3 block text-sm font-semibold text-(--knu-text-primary)"
        >
          성별 <span className="text-red-500">*</span>
        </FieldLabel>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-labelledby={genderLabelId}
          aria-describedby={genderError ? genderErrorId : undefined}
        >
          {(['M', 'F'] as const).map((gender) => (
            <Chip
              key={gender}
              label={gender === 'M' ? '남성' : '여성'}
              selected={basicInfo.gender === gender}
              disabled={disabled}
              onClick={() => {
                onBasicInfoChange({ ...basicInfo, gender });
                onGenderErrorClear();
              }}
              role="radio"
              aria-checked={basicInfo.gender === gender}
            />
          ))}
        </div>
        <FieldMessage error={genderError} errorId={genderErrorId} />
      </Field>

      <div className="grid gap-4">
        <Field
          invalid={Boolean(collegeError)}
          className="flex min-h-32 flex-col rounded-2xl bg-slate-50 p-4"
        >
          <FieldLabel
            htmlFor={collegeSelectId}
            className="block text-sm font-semibold text-(--knu-text-primary)"
          >
            단과대<span className="ml-1 text-red-500">*</span>
          </FieldLabel>
          <FieldDescription className="mt-1 text-xs leading-5 text-(--knu-text-secondary)">
            선택한 캠퍼스의 소속 단과대를 선택해요.
          </FieldDescription>
          <div className="relative mt-auto pt-3">
            <select
              ref={collegeRef}
              id={collegeSelectId}
              value={basicInfo.collegeCode ?? ''}
              disabled={disabled || !basicInfo.campus || collegeOptions.length === 0}
              aria-invalid={!!collegeError}
              aria-describedby={collegeError ? collegeErrorId : undefined}
              onChange={(event) => {
                onBasicInfoChange({
                  ...basicInfo,
                  collegeCode: event.target.value ? (event.target.value as CollegeCode) : null,
                });
                onCollegeErrorClear();
              }}
              className={`h-12 w-full appearance-none rounded-xl border-2 px-4 pr-12 outline-none transition-colors ${
                collegeError
                  ? 'border-red-300 bg-red-50 focus:border-red-500'
                  : 'border-(--knu-border) bg-white focus:border-(--knu-primary)'
              } disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
            >
              <option value="">
                {basicInfo.campus ? '단과대를 선택해요' : '캠퍼스를 먼저 선택해요'}
              </option>
              {collegeOptions.map((college) => (
                <option key={college.code} value={college.code}>
                  {college.nameKo}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 bottom-3.5 size-5 text-slate-500"
              aria-hidden="true"
            />
          </div>
          <FieldMessage error={collegeError} errorId={collegeErrorId} />
        </Field>

        <Field
          invalid={Boolean(birthYearError)}
          className="flex min-h-32 flex-col rounded-2xl bg-slate-50 p-4"
        >
          <FieldLabel
            htmlFor={birthYearSelectId}
            className="block text-sm font-semibold text-(--knu-text-primary)"
          >
            출생연도<span className="ml-1 text-red-500">*</span>
          </FieldLabel>
          <FieldDescription className="mt-1 text-xs leading-5 text-(--knu-text-secondary)">
            만 18세부터 만 30세까지 선택할 수 있어요.
          </FieldDescription>
          <div className="relative mt-auto pt-3">
            <select
              ref={birthYearRef}
              id={birthYearSelectId}
              value={basicInfo.birthYear === null ? '' : String(basicInfo.birthYear)}
              aria-invalid={!!birthYearError}
              aria-describedby={birthYearError ? birthYearErrorId : undefined}
              required
              disabled={disabled}
              onChange={(event) => {
                const nextBirthYear = event.target.value === '' ? null : Number(event.target.value);
                onBasicInfoChange({
                  ...basicInfo,
                  birthYear: Number.isFinite(nextBirthYear) ? nextBirthYear : null,
                });
                onBirthYearErrorClear();
              }}
              className={`h-12 w-full appearance-none rounded-xl border-2 px-4 pr-12 outline-none transition-colors ${
                birthYearError
                  ? 'border-red-300 bg-red-50 focus:border-red-500'
                  : 'border-(--knu-border) bg-white focus:border-(--knu-primary)'
              } disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
            >
              <option value="">출생연도를 선택해요</option>
              {birthYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 bottom-3.5 size-5 text-slate-500"
              aria-hidden="true"
            />
          </div>
          <FieldMessage error={birthYearError} errorId={birthYearErrorId} />
        </Field>
      </div>
    </section>
  );
}
