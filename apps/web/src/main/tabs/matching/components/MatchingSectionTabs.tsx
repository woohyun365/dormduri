'use client';

import { useRef, useState } from 'react';

export type MatchingSection = 'current' | 'past';

const sections: readonly MatchingSection[] = ['current', 'past'];

export function MatchingSectionTabs({
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
    <div
      role="tablist"
      aria-label="매칭 기록 구분"
      className="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm"
    >
      {sections.map((section) => {
        const active = selected === section;
        const label = section === 'current' ? '현재 매칭' : '지난 기록';
        const index = sections.indexOf(section);
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
            className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold outline-none transition motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 ${
              active
                ? 'bg-(--knu-primary) text-white shadow-sm'
                : 'text-(--knu-text-secondary) hover:bg-(--knu-background-alt)'
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
  );
}
