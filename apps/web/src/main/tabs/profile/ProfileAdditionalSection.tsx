import { GraduationCap } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { SectionHeading } from '@/components/SectionHeading';
import {
  COLLEGES,
  GRADES,
  BIRTH_YEARS,
  ADDITIONAL_FIELD_NAMES,
} from '@/constants/additional-profile';
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
              className={`ml-2 font-normal ${additional.college ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
            >
              {additional.college ?? '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {COLLEGES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={additional.college === c}
                onClick={() => onFieldChange('college', additional.college === c ? null : c)}
              />
            ))}
          </div>
        </div>

        {/* 학년 */}
        <div>
          <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
            {ADDITIONAL_FIELD_NAMES.grade}
            <span
              className={`ml-2 font-normal ${additional.grade ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
            >
              {GRADES.find((g) => g.value === additional.grade)?.label ?? '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
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
          <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
            {ADDITIONAL_FIELD_NAMES.birthYear}
            <span
              className={`ml-2 font-normal ${additional.birthYear ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
            >
              {additional.birthYear != null ? `${additional.birthYear}년` : '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {BIRTH_YEARS.map((y) => (
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
