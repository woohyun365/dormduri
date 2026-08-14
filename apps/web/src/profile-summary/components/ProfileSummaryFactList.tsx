import { BatteryLow, Bed, Cigarette, CigaretteOff, Lock, User, Users } from 'lucide-react';
import type { ProfileSummaryFact } from '../model/profileSummaryFacts';

interface ProfileSummaryFactListProps {
  readonly ownerId: string;
  readonly facts: readonly ProfileSummaryFact[];
  readonly className?: string;
}

export function ProfileSummaryFactList({
  ownerId,
  facts,
  className = '',
}: ProfileSummaryFactListProps) {
  if (facts.length === 0) return null;

  return (
    <div className={className}>
      <dl className="sr-only">
        {facts.map((fact) => (
          <div key={`${ownerId}-${fact.label}`}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {facts.map((fact) => (
          <span
            key={`${ownerId}-${fact.label}-chip`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm"
          >
            <ProfileSummaryFactIcon fact={fact} />
            {fact.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfileSummaryFactIcon({ fact }: { readonly fact: ProfileSummaryFact }) {
  const className = `h-3.5 w-3.5 ${getFactIconClassName(fact)}`;
  if (fact.value === '비공개') return <Lock className={className} aria-hidden="true" />;
  if (fact.label === '흡연 여부') {
    if (fact.value === '전자담배') return <BatteryLow className={className} aria-hidden="true" />;
    return fact.value === '비흡연' ? (
      <CigaretteOff className={className} aria-hidden="true" />
    ) : (
      <Cigarette className={className} aria-hidden="true" />
    );
  }
  if (fact.label === '잠버릇') return <Bed className={className} aria-hidden="true" />;
  if (fact.label === '관계') {
    return fact.value === '친하게 지내요' ? (
      <Users className={className} aria-hidden="true" />
    ) : (
      <User className={className} aria-hidden="true" />
    );
  }
  return <Users className={className} aria-hidden="true" />;
}

function getFactIconClassName(fact: ProfileSummaryFact): string {
  if (fact.value === '비공개') return 'text-slate-400';

  const tones: Record<ProfileSummaryFact['label'], string> = {
    '흡연 여부':
      fact.value === '비흡연'
        ? 'text-slate-500'
        : fact.value === '전자담배'
          ? 'text-rose-300'
          : 'text-rose-400',
    잠버릇: fact.value === '잠버릇 있음' ? 'text-amber-400' : 'text-slate-500',
    관계: 'text-slate-500',
  };
  return tones[fact.label];
}
