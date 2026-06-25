'use client';

import { useState } from 'react';

interface InlineTextEditorProps {
  value: string;
  onSave: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  rows?: number;
  allowEmpty?: boolean;
}

export function InlineTextEditor({
  value,
  onSave,
  maxLength,
  placeholder,
  rows = 3,
  allowEmpty = false,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleStartEdit = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!allowEmpty && !trimmed) return;
    onSave(trimmed || (allowEmpty ? '' : value));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className="w-full px-4 py-3 border-2 border-(--knu-border) rounded-xl text-sm text-(--knu-text-primary) placeholder:text-(--knu-text-tertiary) focus:outline-none focus:border-(--knu-primary) transition-colors resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-(--knu-text-tertiary)">
            {draft.length}/{maxLength}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-semibold text-(--knu-text-secondary) bg-(--knu-background-alt) rounded-xl"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold text-white bg-(--knu-primary) rounded-xl hover:bg-(--knu-primary-hover) transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-(--knu-text-tertiary) mb-3">{placeholder}</p>
        <button
          onClick={handleStartEdit}
          className="px-4 py-2 text-sm font-semibold text-(--knu-primary) bg-(--knu-primary-light) rounded-xl"
        >
          작성하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between">
      <p className="text-sm text-(--knu-text-secondary) leading-relaxed flex-1">{value}</p>
      <button
        onClick={handleStartEdit}
        className="ml-3 text-sm font-semibold text-(--knu-primary) shrink-0"
      >
        수정
      </button>
    </div>
  );
}
