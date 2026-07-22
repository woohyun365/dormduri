export interface ProfileSummaryFact {
  readonly label: '흡연 여부' | '잠버릇' | '관계';
  readonly value: string;
}

export interface ProfileSummaryFactSource {
  readonly smokingBehavior: string | null;
  readonly sleepHabit: string | null;
  readonly relationshipStyle: string | null;
}

export function buildProfileSummaryFacts(
  summary: ProfileSummaryFactSource,
): readonly ProfileSummaryFact[] {
  return [
    { label: '흡연 여부', value: smokingBehaviorLabel(summary.smokingBehavior) },
    { label: '잠버릇', value: sleepHabitLabel(summary.sleepHabit) },
    { label: '관계', value: relationshipStyleLabel(summary.relationshipStyle) },
  ];
}

function smokingBehaviorLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    NO: '비흡연',
    E_CIG: '전자담배',
    YES: '흡연',
  };
  return labels[value] ?? value;
}

function sleepHabitLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    NONE: '잠버릇 없음',
    TALKING: '잠버릇 있음',
    SNORING: '잠버릇 있음',
    GRINDING: '잠버릇 있음',
    HAS: '잠버릇 있음',
  };
  return labels[value] ?? value;
}

function relationshipStyleLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    CLOSE: '친하게 지내요',
    CASUAL: '각자 생활해요',
    DISTANT: '각자 생활해요',
  };
  return labels[value] ?? value;
}
