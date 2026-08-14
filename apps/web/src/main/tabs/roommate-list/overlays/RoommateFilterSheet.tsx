'use client';

import { useMemo, useState } from 'react';
import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import {
  buildRoommateFilterSheetViewModel,
  compactRoommateFilterDraft,
  createRoommateFilterDraft,
  setRoommateFilterDraftMinScore,
  setRoommateFilterDraftMbtiTrait,
  setRoommateFilterDraftOperator,
  setRoommateFilterDraftScalar,
  toggleRoommateFilterDraftValue,
  type RoommateFilterDraft,
  type RoommateFilterFieldViewModel,
} from '../model/filters/roommateFilterSheetModel';
import type { RoommateSearchManifestModel } from '../model/filters/roommateSearchManifestModel';
import {
  ROOMMATE_SEARCH_MBTI_TRAIT_KEYS,
  ROOMMATE_SEARCH_SCALAR_FILTER_KEYS,
  type RoommateSearchCriteriaFilterKey,
  type RoommateSearchFilterCriteria,
  type RoommateSearchMbtiTraitKey,
  type RoommateSearchQueryCriteria,
  type RoommateSearchScalarFilterKey,
} from '../model/search/roommateSearchQuery';
import {
  formatRoommateSearchMbtiTraitLabel,
  formatRoommateSearchOperatorLabel,
} from '../model/filters/roommateSearchFilterCopy';
import type {
  RoommateSearchFilterOperator,
  RoommateSearchMinScorePreset,
} from '@repo/shared/roommate-search/contract';

interface RoommateFilterSheetProps {
  readonly isOpen: boolean;
  readonly manifest: RoommateSearchManifestModel | null;
  readonly query: RoommateSearchQueryCriteria;
  readonly disabled?: boolean;
  readonly onClose: () => void;
  readonly onApply: (filters: RoommateSearchFilterCriteria) => void;
}

export function RoommateFilterSheet({
  isOpen,
  manifest,
  query,
  disabled = false,
  onClose,
  onApply,
}: RoommateFilterSheetProps) {
  if (!isOpen) return null;

  return (
    <RoommateFilterSheetContent
      key={`${manifest?.revision ?? 'no-manifest'}:${JSON.stringify(query.filters)}`}
      isOpen={isOpen}
      manifest={manifest}
      query={query}
      disabled={disabled}
      onClose={onClose}
      onApply={onApply}
    />
  );
}

function RoommateFilterSheetContent({
  isOpen,
  manifest,
  query,
  disabled,
  onClose,
  onApply,
}: Required<RoommateFilterSheetProps>) {
  const [draft, setDraft] = useState<RoommateFilterDraft>(() =>
    createRoommateFilterDraft(query.filters),
  );

  const viewModel = useMemo(
    () => buildRoommateFilterSheetViewModel(manifest, query, draft),
    [draft, manifest, query],
  );

  const applyDisabled = disabled || !manifest || !viewModel.canOpen;

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="상대 생활패턴·프로필 필터"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <button
            type="button"
            disabled={applyDisabled}
            onClick={() => setDraft({})}
            className="rounded-2xl border border-(--knu-border) py-3 text-sm font-semibold text-(--knu-text-secondary) transition hover:border-(--knu-primary) disabled:cursor-not-allowed disabled:opacity-50"
          >
            초기화
          </button>
          <button
            type="button"
            disabled={applyDisabled}
            onClick={() => {
              if (!manifest) return;
              onApply(compactRoommateFilterDraft(draft, manifest));
              onClose();
            }}
            className="rounded-2xl bg-(--knu-primary) py-3 text-sm font-semibold text-white transition hover:bg-(--knu-primary-hover) disabled:cursor-not-allowed disabled:bg-gray-200"
          >
            필터 적용
          </button>
        </div>
      }
    >
      <div className="space-y-5 px-5 py-5">
        {viewModel.policyCopy ? (
          <p className="rounded-2xl bg-(--knu-background-alt) px-4 py-3 text-sm leading-6 text-(--knu-text-secondary)">
            {viewModel.policyCopy}
          </p>
        ) : null}

        {viewModel.fields.map((field) => (
          <FilterField key={field.key} field={field} draft={draft} onChange={setDraft} />
        ))}
      </div>
    </BaseBottomSheet>
  );
}

function FilterField({
  field,
  draft,
  onChange,
}: {
  readonly field: RoommateFilterFieldViewModel;
  readonly draft: RoommateFilterDraft;
  readonly onChange: (draft: RoommateFilterDraft) => void;
}) {
  return (
    <fieldset className="rounded-3xl border border-(--knu-border) bg-white p-4">
      <legend className="px-1 text-sm font-bold text-(--knu-text-primary)">{field.label}</legend>
      {field.disabledReason || field.helperText ? (
        <div className="mt-0 space-y-0">
          {field.disabledReason ? (
            <p className="text-xs text-(--knu-text-tertiary)">{field.disabledReason}</p>
          ) : null}
          {field.helperText ? (
            <p className="text-xs leading-5 text-(--knu-text-tertiary)">{field.helperText}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {field.kind === 'operator-values' ? (
          <OperatorSelector field={field} draft={draft} onChange={onChange} />
        ) : null}

        {field.kind === 'mbti-traits' ? (
          <MbtiTraitSelector field={field} draft={draft} onChange={onChange} />
        ) : (
          <OptionButtons field={field} draft={draft} onChange={onChange} />
        )}
      </div>
    </fieldset>
  );
}

function OperatorSelector({
  field,
  draft,
  onChange,
}: {
  readonly field: RoommateFilterFieldViewModel;
  readonly draft: RoommateFilterDraft;
  readonly onChange: (draft: RoommateFilterDraft) => void;
}) {
  if (field.key !== 'college' && field.key !== 'grade') return null;
  if (field.operators.length <= 1) return null;
  const key = field.key;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`${field.label} 조건`}>
      {field.operators.map((operator) => (
        <button
          key={operator}
          type="button"
          onClick={() => onChange(setRoommateFilterDraftOperator(draft, key, operator))}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            field.selectedOperator === operator
              ? 'bg-(--knu-primary) text-white'
              : 'bg-(--knu-background-alt) text-(--knu-text-secondary) hover:bg-gray-200'
          }`}
        >
          {operatorLabel(operator)}
        </button>
      ))}
    </div>
  );
}

function OptionButtons({
  field,
  draft,
  onChange,
}: {
  readonly field: RoommateFilterFieldViewModel;
  readonly draft: RoommateFilterDraft;
  readonly onChange: (draft: RoommateFilterDraft) => void;
}) {
  if (field.kind === 'mbti-traits') return null;
  if (field.key === 'sleepHabit') {
    return <SleepHabitPreferenceButtons draft={draft} onChange={onChange} />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {field.options.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => onChange(nextDraftForOption(draft, field.key, option.code))}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            option.selected
              ? 'bg-(--knu-primary) text-white'
              : 'bg-(--knu-background-alt) text-(--knu-text-secondary) hover:bg-gray-200'
          }`}
          aria-pressed={option.selected}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SleepHabitPreferenceButtons({
  draft,
  onChange,
}: {
  readonly draft: RoommateFilterDraft;
  readonly onChange: (draft: RoommateFilterDraft) => void;
}) {
  const noHabitSelected = draft.sleepHabit === 'NONE';
  const anySelected = draft.sleepHabit !== 'NONE';

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(setRoommateFilterDraftScalar(draft, 'sleepHabit', 'NONE'))}
        className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
          noHabitSelected
            ? 'bg-(--knu-primary) text-white'
            : 'bg-(--knu-background-alt) text-(--knu-text-secondary) hover:bg-gray-200'
        }`}
        aria-pressed={noHabitSelected}
      >
        잠버릇 없음
      </button>
      <button
        type="button"
        onClick={() => onChange(setRoommateFilterDraftScalar(draft, 'sleepHabit', null))}
        className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
          anySelected
            ? 'bg-(--knu-primary) text-white'
            : 'bg-(--knu-background-alt) text-(--knu-text-secondary) hover:bg-gray-200'
        }`}
        aria-pressed={anySelected}
      >
        잠버릇 있어도 상관없음
      </button>
    </div>
  );
}

function MbtiTraitSelector({
  field,
  draft,
  onChange,
}: {
  readonly field: RoommateFilterFieldViewModel;
  readonly draft: RoommateFilterDraft;
  readonly onChange: (draft: RoommateFilterDraft) => void;
}) {
  return (
    <div className="space-y-3">
      {ROOMMATE_SEARCH_MBTI_TRAIT_KEYS.map((trait) => {
        const options = optionsForMbtiTrait(field, trait);
        if (options.length === 0) return null;
        return (
          <div key={trait}>
            <p className="mb-2 text-xs font-semibold text-(--knu-text-tertiary)">
              {mbtiTraitLabel(trait)}
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const selected = draft.mbtiTraits?.[trait] === option.code;
                return (
                  <button
                    key={option.code}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      onChange(setRoommateFilterDraftMbtiTrait(draft, trait, option.code))
                    }
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      selected
                        ? 'bg-(--knu-primary) text-white'
                        : 'bg-(--knu-background-alt) text-(--knu-text-secondary) hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function nextDraftForOption(
  draft: RoommateFilterDraft,
  key: RoommateSearchCriteriaFilterKey,
  code: string,
): RoommateFilterDraft {
  if (isScalarKey(key) || key === 'minScore') {
    if (key === 'minScore') {
      return setRoommateFilterDraftMinScore(draft, Number(code) as RoommateSearchMinScorePreset);
    }
    return setRoommateFilterDraftScalar(draft, key, code);
  }
  if (key === 'college' || key === 'grade' || key === 'ageBand') {
    return toggleRoommateFilterDraftValue(draft, key, code);
  }
  return draft;
}

function isScalarKey(key: RoommateSearchCriteriaFilterKey): key is RoommateSearchScalarFilterKey {
  return ROOMMATE_SEARCH_SCALAR_FILTER_KEYS.includes(key as RoommateSearchScalarFilterKey);
}

function optionsForMbtiTrait(
  field: RoommateFilterFieldViewModel,
  trait: RoommateSearchMbtiTraitKey,
) {
  const allowed: Record<RoommateSearchMbtiTraitKey, readonly string[]> = {
    energy: ['E', 'I'],
    perception: ['N', 'S'],
    decision: ['T', 'F'],
    lifestyle: ['J', 'P'],
  };
  return field.options.filter((option) => allowed[trait].includes(option.code));
}

function operatorLabel(operator: RoommateSearchFilterOperator): string {
  return formatRoommateSearchOperatorLabel(operator);
}

function mbtiTraitLabel(trait: RoommateSearchMbtiTraitKey): string {
  return formatRoommateSearchMbtiTraitLabel(trait);
}
