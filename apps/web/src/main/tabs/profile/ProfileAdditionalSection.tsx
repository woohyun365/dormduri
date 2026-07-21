import { GraduationCap } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { SectionHeading } from '@/main/tabs/profile/components/SectionHeading';
import {
  COLLEGE_OPTIONS,
  GRADE_OPTIONS,
  BIRTH_YEAR_OPTIONS,
  ADDITIONAL_FIELD_LABELS,
  getCollegeLabel,
} from '@/main/tabs/profile/model/profileFieldOptions';
import { ProfileMbtiSelector } from './ProfileMbtiSelector';
import type { AdditionalProfile } from '@/types/additional-profile';

interface ProfileAdditionalSectionProps {
  additional: AdditionalProfile;
  onFieldChange: (field: keyof AdditionalProfile, value: string | null) => void;
}

export function ProfileAdditionalSection({
  additional,
  onFieldChange,
}: ProfileAdditionalSectionProps) {
  return (
    <section>
      <SectionHeading
        icon={<GraduationCap className="w-5 h-5 text-(--knu-primary)" />}
        title="추가 정보"
        suffix="(선택)"
      />
      <div className="bg-white rounded-2xl border-2 border-(--knu-border) p-5 space-y-5">
        {/* 단대 */}
        <div>
          <p className="text-sm font-semibold text-(--knu-text-primary) mb-2">
            {ADDITIONAL_FIELD_LABELS.college}
            <span
              className={`ml-2 font-normal ${additional.college ? 'text-(--knu-primary)' : 'text-(--knu-text-tertiary)'}`}
            >
              {getCollegeLabel(additional.college) ?? '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {COLLEGE_OPTIONS.map((college) => (
              <Chip
                key={college.value}
                label={college.label}
                selected={additional.college === college.value}
                onClick={() =>
                  onFieldChange(
                    'college',
                    additional.college === college.value ? null : college.value,
                  )
                }
              />
            ))}
          </div>
        </div>

        {/* 학년 */}
        <div>
          <p className="text-sm font-semibold text-(--knu-text-primary) mb-2">
            {ADDITIONAL_FIELD_LABELS.grade}
            <span
              className={`ml-2 font-normal ${additional.grade ? 'text-(--knu-primary)' : 'text-(--knu-text-tertiary)'}`}
            >
              {GRADE_OPTIONS.find((g) => g.value === additional.grade)?.label ?? '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {GRADE_OPTIONS.map((g) => (
              <Chip
                key={g.value}
                label={g.label}
                selected={additional.grade === g.value}
                onClick={() =>
                  onFieldChange('grade', additional.grade === g.value ? null : g.value)
                }
              />
            ))}
          </div>
        </div>

        {/* MBTI */}
        <ProfileMbtiSelector
          value={additional.mbti}
          onChange={(mbti) => onFieldChange('mbti', mbti)}
        />

        {/* 출생연도 */}
        <div>
          <p className="text-sm font-semibold text-(--knu-text-primary) mb-2">
            {ADDITIONAL_FIELD_LABELS.birthYear}
            <span
              className={`ml-2 font-normal ${additional.birthYear ? 'text-(--knu-primary)' : 'text-(--knu-text-tertiary)'}`}
            >
              {additional.birthYear != null ? `${additional.birthYear}년` : '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {BIRTH_YEAR_OPTIONS.map((y) => (
              <Chip
                key={y.value}
                label={y.label}
                selected={additional.birthYear === y.value}
                onClick={() =>
                  onFieldChange(
                    'birthYear',
                    additional.birthYear === y.value ? null : String(y.value),
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
