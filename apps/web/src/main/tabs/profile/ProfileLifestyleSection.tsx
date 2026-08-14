import { Cigarette, Moon, Sun, Coffee, Volume2, Sparkles, Heart, Edit2, Lock } from 'lucide-react';
import { SectionHeading } from '@/main/tabs/profile/components/SectionHeading';
import { formatLifestyleOptionLabel } from '@repo/shared/lifestyle';
import type { LifestyleData } from '@repo/shared/lifestyle';

interface ProfileLifestyleSectionProps {
  lifestyle: LifestyleData;
  isLocked: boolean;
  onEdit: () => void;
}

export function ProfileLifestyleSection({
  lifestyle,
  isLocked,
  onEdit,
}: ProfileLifestyleSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeading
          icon={<Sparkles className="w-5 h-5 text-(--knu-primary)" />}
          title="생활패턴 프로필"
        />
        <div className="flex items-center gap-2">
          {isLocked && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              일부 잠금
            </span>
          )}
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-sm font-semibold text-(--knu-primary)"
          >
            <Edit2 className="w-4 h-4" />
            수정
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border-2 border-(--knu-border) p-5">
        <div className="grid grid-cols-2 gap-4">
          <GridItem
            icon={<Cigarette className="w-4 h-4 text-red-600" />}
            bg="bg-red-100"
            label="흡연 여부"
            value={formatLifestyleOptionLabel('smokingBehavior', lifestyle.smokingBehavior)}
          />
          <GridItem
            icon={<Moon className="w-4 h-4 text-indigo-600" />}
            bg="bg-indigo-100"
            label="잠버릇"
            value={formatLifestyleOptionLabel('sleepHabit', lifestyle.sleepHabit)}
          />
          <GridItem
            icon={<Coffee className="w-4 h-4 text-yellow-600" />}
            bg="bg-yellow-100"
            label="실내 취식"
            value={formatLifestyleOptionLabel('indoorEating', lifestyle.indoorEating)}
          />
          <GridItem
            icon={<Moon className="w-4 h-4 text-blue-600" />}
            bg="bg-blue-100"
            label="취침 시간"
            value={formatLifestyleOptionLabel('bedtime', lifestyle.bedtime)}
          />
          <GridItem
            icon={<Sun className="w-4 h-4 text-orange-600" />}
            bg="bg-orange-100"
            label="기상 시간"
            value={formatLifestyleOptionLabel('wakeTime', lifestyle.wakeTime)}
          />
          <GridItem
            icon={<Volume2 className="w-4 h-4 text-purple-600" />}
            bg="bg-purple-100"
            label="소음 민감도"
            value={formatLifestyleOptionLabel('noiseSensitivity', lifestyle.noiseSensitivity)}
          />
          <GridItem
            icon={<Sparkles className="w-4 h-4 text-green-600" />}
            bg="bg-green-100"
            label="청소 빈도"
            value={formatLifestyleOptionLabel('cleanLevel', lifestyle.cleanLevel)}
          />
          <GridItem
            icon={<Heart className="w-4 h-4 text-pink-600" />}
            bg="bg-pink-100"
            label="관계 성향"
            value={formatLifestyleOptionLabel('relationshipStyle', lifestyle.relationshipStyle)}
          />
        </div>
      </div>
    </section>
  );
}

function GridItem({
  icon,
  bg,
  label,
  value,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-(--knu-text-tertiary)">{label}</p>
        <p
          className={`text-sm font-semibold truncate ${value === '미입력' ? 'text-(--knu-text-tertiary)' : 'text-(--knu-text-primary)'}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
