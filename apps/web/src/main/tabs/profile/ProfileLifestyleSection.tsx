import { Cigarette, Moon, Sun, Coffee, Volume2, Sparkles, Heart, Edit2 } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
import { getLifestyleLabel } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface ProfileLifestyleSectionProps {
  lifestyle: LifestyleData;
  onEdit: () => void;
}

export function ProfileLifestyleSection({ lifestyle, onEdit }: ProfileLifestyleSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeading
          icon={<Sparkles className="w-5 h-5 text-[var(--knu-primary)]" />}
          title="생활패턴 프로필"
        />
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-sm font-semibold text-[var(--knu-primary)]"
        >
          <Edit2 className="w-4 h-4" />
          수정
        </button>
      </div>
      <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
        <div className="grid grid-cols-2 gap-4">
          <GridItem
            icon={<Cigarette className="w-4 h-4 text-red-600" />}
            bg="bg-red-100"
            label="흡연 여부"
            value={getLifestyleLabel('smoker', lifestyle.smoker)}
          />
          <GridItem
            icon={<Moon className="w-4 h-4 text-indigo-600" />}
            bg="bg-indigo-100"
            label="잠버릇"
            value={getLifestyleLabel('sleepHabit', lifestyle.sleepHabit)}
          />
          <GridItem
            icon={<Coffee className="w-4 h-4 text-yellow-600" />}
            bg="bg-yellow-100"
            label="실내 취식"
            value={getLifestyleLabel('indoorEating', lifestyle.indoorEating)}
          />
          <GridItem
            icon={<Moon className="w-4 h-4 text-blue-600" />}
            bg="bg-blue-100"
            label="취침 시간"
            value={getLifestyleLabel('bedtime', lifestyle.bedtime)}
          />
          <GridItem
            icon={<Sun className="w-4 h-4 text-orange-600" />}
            bg="bg-orange-100"
            label="기상 시간"
            value={getLifestyleLabel('wakeTime', lifestyle.wakeTime)}
          />
          <GridItem
            icon={<Volume2 className="w-4 h-4 text-purple-600" />}
            bg="bg-purple-100"
            label="소음 민감도"
            value={getLifestyleLabel('noiseSensitivity', lifestyle.noiseSensitivity)}
          />
          <GridItem
            icon={<Sparkles className="w-4 h-4 text-green-600" />}
            bg="bg-green-100"
            label="청결도"
            value={getLifestyleLabel('cleanliness', lifestyle.cleanliness)}
          />
          <GridItem
            icon={<Heart className="w-4 h-4 text-pink-600" />}
            bg="bg-pink-100"
            label="관계 성향"
            value={getLifestyleLabel('relationshipStyle', lifestyle.relationshipStyle)}
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
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--knu-text-tertiary)]">{label}</p>
        <p
          className={`text-sm font-semibold truncate ${value === '미입력' ? 'text-[var(--knu-text-tertiary)]' : 'text-[var(--knu-text-primary)]'}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
