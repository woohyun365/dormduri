'use client';

import { Check, ChevronRight, X } from 'lucide-react';
import type { ChecklistItem, ChecklistNavigateTo } from '@/utils/onboarding';

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  onNavigate: (target: ChecklistNavigateTo) => void;
  onDismiss: () => void;
}

export function OnboardingChecklist({ items, onNavigate, onDismiss }: OnboardingChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length;

  return (
    <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-[var(--knu-text-primary)]">시작하기</h3>
          <span className="text-xs font-semibold text-[var(--knu-primary)] bg-[var(--knu-primary-light)] px-2 py-0.5 rounded-full">
            {completedCount}/{items.length}
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="닫기"
          className="p-1 rounded-lg text-[var(--knu-text-tertiary)] hover:bg-[var(--knu-background-alt)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            data-checklist-item
            data-completed={item.completed ? 'true' : 'false'}
            onClick={item.completed ? undefined : () => onNavigate(item.navigateTo)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              item.completed
                ? 'bg-green-50 cursor-default'
                : 'bg-[var(--knu-background-alt)] cursor-pointer hover:bg-gray-100'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.completed ? 'bg-green-500 text-white' : 'border-2 border-gray-300'
              }`}
            >
              {item.completed && <Check className="w-3 h-3" />}
            </div>
            <span
              className={`flex-1 text-sm ${
                item.completed
                  ? 'text-green-700 line-through'
                  : 'text-[var(--knu-text-primary)] font-medium'
              }`}
            >
              {item.label}
            </span>
            {!item.completed && (
              <ChevronRight className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
