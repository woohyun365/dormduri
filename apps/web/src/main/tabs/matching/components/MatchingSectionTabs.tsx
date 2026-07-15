'use client';

export type MatchingSection = 'current' | 'past';

const sections: readonly MatchingSection[] = ['current', 'past'];

export function MatchingSectionTabs({
  selected,
  onSelect,
}: {
  readonly selected: MatchingSection;
  readonly onSelect: (section: MatchingSection) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="매칭 기록 구분"
      className="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm"
    >
      {sections.map((section) => {
        const active = selected === section;
        const label = section === 'current' ? '현재 매칭' : '지난 기록';
        return (
          <button
            key={section}
            id={`matching-section-tab-${section}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`matching-section-panel-${section}`}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 ${
              active
                ? 'bg-(--knu-primary) text-white shadow-sm'
                : 'text-(--knu-text-secondary) hover:bg-(--knu-background-alt)'
            }`}
            onClick={() => onSelect(section)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
