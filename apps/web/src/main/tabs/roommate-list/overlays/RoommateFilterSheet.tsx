'use client';

import { useMemo, useState } from 'react';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
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
      title="룸메이트 상세 필터"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <button
            type="button"
            disabled={applyDisabled}
            onClick={() => setDraft({})}
            className="rounded-2xl border border-[var(--knu-border)] py-3 text-sm font-semibold text-[var(--knu-text-secondary)] transition hover:border-[var(--knu-primary)] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-2xl bg-[var(--knu-primary)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--knu-primary-dark)] disabled:cursor-not-allowed disabled:bg-gray-200"
          >
            필터 적용
          </button>
        </div>
      }
    >
      <div className="space-y-5 px-5 py-5">
        {viewModel.policyCopy ? (
          <p className="rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-sm leading-6 text-[var(--knu-text-secondary)]">
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
    <fieldset className="space-y-3 rounded-3xl border border-[var(--knu-border)] bg-white p-4">
      <legend className="px-1 text-sm font-bold text-[var(--knu-text-primary)]">
        {field.label}
      </legend>
      {field.disabledReason ? (
        <p className="text-xs text-[var(--knu-text-tertiary)]">{field.disabledReason}</p>
      ) : null}

      {field.kind === 'operator-values' ? (
        <OperatorSelector field={field} draft={draft} onChange={onChange} />
      ) : null}

      {field.kind === 'mbti-traits' ? (
        <MbtiTraitSelector field={field} draft={draft} onChange={onChange} />
      ) : (
        <OptionButtons field={field} draft={draft} onChange={onChange} />
      )}
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
              ? 'bg-[var(--knu-primary)] text-white'
              : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
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
  return (
    <div className="flex flex-wrap gap-2">
      {field.options.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => onChange(nextDraftForOption(draft, field.key, option.code))}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            option.selected
              ? 'bg-[var(--knu-primary)] text-white'
              : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
          }`}
          aria-pressed={option.selected}
        >
          {option.label}
        </button>
      ))}
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
            <p className="mb-2 text-xs font-semibold text-[var(--knu-text-tertiary)]">
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
                        ? 'bg-[var(--knu-primary)] text-white'
                        : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
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
  return operator === 'EXCLUDE' ? '제외' : '포함';
}

function mbtiTraitLabel(trait: RoommateSearchMbtiTraitKey): string {
  const labels: Record<RoommateSearchMbtiTraitKey, string> = {
    energy: '에너지',
    perception: '인식',
    decision: '판단',
    lifestyle: '생활 양식',
  };
  return labels[trait];
}
