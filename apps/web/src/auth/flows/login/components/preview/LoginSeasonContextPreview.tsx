'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  Archive,
  CalendarCheck2,
  CheckCheck,
  ClipboardCheck,
  FileClock,
  History,
  ListChecks,
  Search,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { LOGIN_PREVIEW_SEASON_STEPS } from '../../model/login-preview.examples';

const DEFAULT_PREVIEW_SEASON_ID = 'season-matching';
type SeasonStepId = (typeof LOGIN_PREVIEW_SEASON_STEPS)[number]['id'];

const SEASON_ICONS = {
  'off-season': Archive,
  'season-open': ClipboardCheck,
  'season-matching': UsersRound,
  'post-match': FileClock,
} as const;

const FLOW_ICONS = {
  season: CalendarCheck2,
  history: History,
  registration: UserRoundCheck,
  explore: Search,
  request: CheckCheck,
  result: ClipboardCheck,
  activity: ListChecks,
} as const;

export function LoginSeasonContextPreview() {
  const idPrefix = useId();
  const [selectedSeasonId, setSelectedSeasonId] = useState<SeasonStepId>(DEFAULT_PREVIEW_SEASON_ID);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedSeason =
    LOGIN_PREVIEW_SEASON_STEPS.find((step) => step.id === selectedSeasonId) ??
    LOGIN_PREVIEW_SEASON_STEPS[2];
  const panelId = `${idPrefix}-season-panel`;

  const selectSeasonAt = (index: number) => {
    const nextStep = LOGIN_PREVIEW_SEASON_STEPS[index];
    if (!nextStep) return;

    setSelectedSeasonId(nextStep.id);
    tabRefs.current[index]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = LOGIN_PREVIEW_SEASON_STEPS.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;
    if (nextIndex === null) return;

    event.preventDefault();
    selectSeasonAt(nextIndex);
  };

  return (
    <section
      aria-label="시즌 이용 상태 예시"
      className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-slate-600">시즌별 이용 예시</p>
        <span
          data-testid="selected-season-label"
          className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-blue-700 ring-1 ring-blue-100"
        >
          {selectedSeason.label}
        </span>
      </div>

      <div className="relative mt-3 rounded-2xl px-1 pt-1 pb-4 ring-1 ring-blue-100">
        <span
          className="absolute top-5 right-[12.5%] left-[12.5%] h-px bg-blue-100"
          aria-hidden="true"
        />
        <div
          role="tablist"
          aria-label="서비스 시즌 흐름"
          className="relative grid grid-cols-4 gap-1"
        >
          {LOGIN_PREVIEW_SEASON_STEPS.map((step, index) => {
            const Icon = SEASON_ICONS[step.id];
            const active = step.id === selectedSeason.id;
            const tabId = `${idPrefix}-${step.id}-tab`;

            return (
              <button
                key={step.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                onClick={() => setSelectedSeasonId(step.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`group min-w-0 rounded-xl border px-0.5 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  active
                    ? 'border-blue-100 bg-white/80'
                    : 'border-transparent hover:border-blue-100 hover:bg-white/60'
                }`}
              >
                <span
                  className={`relative mx-auto flex size-8 items-center justify-center rounded-full border ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-blue-100 bg-white text-slate-500'
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span
                  className={`mt-2 block keep-all text-[10px] font-bold leading-4 ${
                    active ? 'text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {step.label}
                </span>
                <span className="block keep-all text-[9px] leading-4 text-slate-500">
                  {step.helper}
                </span>
              </button>
            );
          })}
        </div>

        <p className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-full bg-blue-50 px-2 text-[9px] font-medium leading-4 text-blue-600">
          시즌을 눌러 이용 흐름을 확인해 보세요
        </p>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-${selectedSeason.id}-tab`}
        tabIndex={0}
        className="mt-5 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-[10px] leading-4 text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
      >
        <p className="whitespace-nowrap">
          <strong className="font-bold text-blue-700">{selectedSeason.label}</strong>
          <span className="ml-1">{selectedSeason.description}</span>
        </p>

        <div className="relative mt-3 border-t border-slate-100 pt-3">
          <span
            className="absolute top-7 h-px bg-slate-200"
            style={{
              left: `${50 / selectedSeason.flow.length}%`,
              right: `${50 / selectedSeason.flow.length}%`,
            }}
            aria-hidden="true"
          />
          <ol
            aria-label={`${selectedSeason.label} 이용 흐름`}
            className="relative grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${selectedSeason.flow.length}, minmax(0, 1fr))`,
            }}
          >
            {selectedSeason.flow.map((step, index) => {
              const Icon = FLOW_ICONS[step.id];
              const isLast = index === selectedSeason.flow.length - 1;

              return (
                <li key={step.id} className="min-w-0 text-center">
                  <span
                    className={`relative mx-auto flex size-8 items-center justify-center rounded-full border bg-white ${
                      isLast
                        ? 'border-emerald-200 text-emerald-600'
                        : 'border-blue-100 text-blue-600'
                    }`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="mt-1.5 block keep-all text-[9px] font-semibold leading-4 text-slate-600">
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
