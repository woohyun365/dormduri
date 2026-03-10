import { useState } from 'react';
import { MBTI_DIMENSIONS, ADDITIONAL_FIELD_NAMES } from '@/constants/additional-profile';

interface ProfileMbtiSelectorProps {
  value: string | null;
  onChange: (mbti: string | null) => void;
}

export function ProfileMbtiSelector({ value, onChange }: ProfileMbtiSelectorProps) {
  // 로컬 draft로 중간 상태(1~3글자) 유지 — 부모에는 4글자 완성 시에만 전달
  const [draft, setDraft] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? '');
  }

  const sortMBTI = (s: string) => {
    const order = 'EISNTFJP';
    return s
      .split('')
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .join('');
  };

  const handleToggle = (dim: (typeof MBTI_DIMENSIONS)[number], opt: string) => {
    const other = dim.options.find((o) => o !== opt)!;
    let next = draft;
    if (draft.includes(opt)) {
      // 이미 선택된 글자 클릭 → 같은 차원의 반대 옵션으로 전환
      next = next.replace(opt, other);
    } else {
      next = next.replace(other, '') + opt;
    }
    const sorted = sortMBTI(next);
    setDraft(sorted);
    onChange(sorted.length === 4 ? sorted : null);
  };

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
        {ADDITIONAL_FIELD_NAMES.mbti}
      </p>
      <div className="flex gap-2">
        {MBTI_DIMENSIONS.map((dim) => (
          <div key={dim.key} className="flex flex-1 gap-1">
            {dim.options.map((opt) => {
              const isSelected = draft.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleToggle(dim, opt)}
                  className={`flex-1 h-9 sm:h-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-[var(--knu-primary)] text-white'
                      : 'bg-[var(--knu-background-alt)] text-[var(--knu-text-secondary)] hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {draft.length > 0 && (
        <div className="flex items-center justify-between mt-2">
          <p
            className={`text-sm font-semibold ${draft.length === 4 ? 'text-[var(--knu-primary)]' : 'text-orange-600'}`}
          >
            {draft}
            {draft.length < 4 && ` · ${4 - draft.length}개 더 선택해주세요`}
          </p>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onChange(null);
            }}
            className="text-xs text-[var(--knu-text-tertiary)] hover:text-red-500 transition-colors"
          >
            초기화
          </button>
        </div>
      )}
    </div>
  );
}
