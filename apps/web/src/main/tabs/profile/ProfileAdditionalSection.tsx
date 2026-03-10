import { GraduationCap, Thermometer } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { SectionHeading } from '@/components/SectionHeading';
import {
  COLLEGES,
  GRADES,
  TEMPERATURE_SENSITIVITY,
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

        {/* 온도 민감도 */}
        <div>
          <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2 flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
            {ADDITIONAL_FIELD_NAMES.temperatureSensitivity}
            <span
              className={`font-normal ${additional.temperatureSensitivity ? 'text-[var(--knu-primary)]' : 'text-[var(--knu-text-tertiary)]'}`}
            >
              {TEMPERATURE_SENSITIVITY.find((t) => t.value === additional.temperatureSensitivity)
                ?.label ?? '-'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPERATURE_SENSITIVITY.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={additional.temperatureSensitivity === t.value}
                onClick={() =>
                  onFieldChange(
                    'temperatureSensitivity',
                    additional.temperatureSensitivity === t.value ? null : t.value,
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
