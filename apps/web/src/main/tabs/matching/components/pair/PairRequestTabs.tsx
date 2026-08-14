'use client';

import { useRef, useState } from 'react';

export type MatchingRequestTab = 'received' | 'sent';

const tabs: readonly MatchingRequestTab[] = ['sent', 'received'];

export function PairRequestTabs({
  selected,
  onSelect,
  quota,
  receivedPendingCount,
}: {
  readonly selected: MatchingRequestTab;
  readonly onSelect: (tab: MatchingRequestTab) => void;
  readonly quota: { readonly used: number; readonly limit: number };
  readonly receivedPendingCount: number;
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
    <section aria-label="요청함 구분" data-design-source="legacy-pair">
      <div
        role="tablist"
        aria-label="매칭 요청 구분"
        className="flex gap-1 rounded-xl bg-[var(--knu-background-alt)] p-1"
      >
        {tabs.map((tab, index) => {
          const label =
            tab === 'received' ? '받은 요청' : `보낸 요청 (${quota.used}/${quota.limit})`;
          const accessibleLabel =
            tab === 'received' ? `받은 요청 ${receivedPendingCount}` : `보낸 요청 ${quota.used}`;
          return (
            <button
              key={tab}
              ref={(node) => {
                refs.current[tab] = node;
              }}
              id={`matching-requests-tab-${tab}`}
              type="button"
              role="tab"
              aria-label={accessibleLabel}
              tabIndex={focused === tab ? 0 : -1}
              aria-selected={selected === tab}
              aria-controls={`matching-requests-panel-${tab}`}
              className={`relative min-h-11 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-(--knu-primary) focus-visible:ring-offset-2 motion-reduce:transition-none ${
                selected === tab
                  ? 'bg-white text-[var(--knu-primary)] shadow-sm'
                  : 'text-[var(--knu-text-secondary)] hover:text-[var(--knu-text-primary)]'
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
              {label}
              {tab === 'received' && receivedPendingCount > 0 ? (
                <span
                  data-testid="matching-received-request-badge"
                  aria-hidden
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white"
                >
                  {receivedPendingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
