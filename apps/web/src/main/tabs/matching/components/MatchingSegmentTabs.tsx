'use client';

import { useRef, useState } from 'react';

export type MatchingRequestTab = 'received' | 'sent';

const tabs: readonly MatchingRequestTab[] = ['received', 'sent'];

export function MatchingSegmentTabs({
  selected,
  onSelect,
  counts,
}: {
  readonly selected: MatchingRequestTab;
  readonly onSelect: (tab: MatchingRequestTab) => void;
  readonly counts: Record<MatchingRequestTab, number>;
}) {
  const [focused, setFocused] = useState<MatchingRequestTab>(selected);
  const refs = useRef<Record<MatchingRequestTab, HTMLButtonElement | null>>({
    received: null,
    sent: null,
  });

  const focus = (tab: MatchingRequestTab) => {
    setFocused(tab);
    refs.current[tab]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="매칭 요청 구분"
      className="grid grid-cols-2 rounded-2xl bg-(--knu-background-alt) p-1"
    >
      {tabs.map((tab, index) => {
        const label = tab === 'received' ? '받은 요청' : '보낸 요청';
        const tabId = `matching-requests-tab-${tab}`;
        return (
          <button
            key={tab}
            ref={(node) => {
              refs.current[tab] = node;
            }}
            id={tabId}
            type="button"
            role="tab"
            tabIndex={focused === tab ? 0 : -1}
            aria-selected={selected === tab}
            aria-controls={`matching-requests-panel-${tab}`}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 ${
              selected === tab
                ? 'bg-white text-(--knu-primary) shadow-sm'
                : 'text-(--knu-text-secondary)'
            }`}
            onFocus={() => setFocused(tab)}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                focus(tabs[(index + 1) % tabs.length]!);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                focus(tabs[(index - 1 + tabs.length) % tabs.length]!);
              } else if (event.key === 'Home') {
                event.preventDefault();
                focus(tabs[0]!);
              } else if (event.key === 'End') {
                event.preventDefault();
                focus(tabs[tabs.length - 1]!);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(tab);
              }
            }}
          >
            {label} {counts[tab]}
          </button>
        );
      })}
    </div>
  );
}
