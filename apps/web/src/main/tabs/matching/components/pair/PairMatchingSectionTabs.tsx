'use client';

import { useRef, useState } from 'react';

export type MatchingSection = 'current' | 'past';

const sections: readonly MatchingSection[] = ['current', 'past'];

export function PairMatchingSectionTabs({
  selected,
  onSelect,
}: {
  readonly selected: MatchingSection;
  readonly onSelect: (section: MatchingSection) => void;
}) {
  const [focused, setFocused] = useState<MatchingSection>(selected);
  const refs = useRef<Record<MatchingSection, HTMLButtonElement | null>>({
    current: null,
    past: null,
  });

  const focus = (section: MatchingSection) => {
    setFocused(section);
    refs.current[section]?.focus();
  };

  return (
    <section
      aria-label="매칭 화면 구분"
      data-design-source="legacy-pair"
      className="flex gap-1 rounded-xl border-2 border-[var(--knu-border)] bg-[var(--knu-background-alt)] p-1"
    >
      <div role="tablist" aria-label="매칭 기록 구분" className="contents">
        {sections.map((section, index) => {
          const active = selected === section;
          const label = section === 'current' ? '현재 매칭' : '지난 기록';
          return (
            <button
              key={section}
              ref={(node) => {
                refs.current[section] = node;
              }}
              id={`matching-section-tab-${section}`}
              type="button"
              role="tab"
              tabIndex={focused === section ? 0 : -1}
              aria-selected={active}
              aria-controls={`matching-section-panel-${section}`}
              className={`relative min-h-11 flex-1 rounded-lg px-4 py-2.5 text-sm font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 motion-reduce:transition-none ${
                active
                  ? 'bg-white text-[var(--knu-primary)] shadow-sm'
                  : 'text-[var(--knu-text-tertiary)] hover:text-[var(--knu-text-secondary)]'
              }`}
              onFocus={() => setFocused(section)}
              onClick={() => onSelect(section)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  focus(sections[(index + 1) % sections.length]!);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  focus(sections[(index - 1 + sections.length) % sections.length]!);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  focus(sections[0]!);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  focus(sections[sections.length - 1]!);
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(section);
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
