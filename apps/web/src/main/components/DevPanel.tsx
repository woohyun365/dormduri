'use client';

import { useState } from 'react';
import { DORMITORIES, UNASSIGNED_ID } from '@/constants/dormitory';

/**
 * 개발 환경 전용 플로팅 패널
 *
 * localStorage에 dev-gender, dev-dormitory 값을 저장하고
 * 페이지를 새로고침하여 mock 유저 설정을 전환한다.
 *
 * production 빌드에서는 렌더링하지 않는다.
 */
export function DevPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentGender] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('dev-gender') : null) ?? 'M',
  );
  const [currentDormitory] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('dev-dormitory') : null) ?? '',
  );

  if (process.env.NODE_ENV !== 'development') return null;

  function handleGenderChange(gender: string) {
    localStorage.setItem('dev-gender', gender);
    window.location.reload();
  }

  function handleDormitoryChange(dormitoryId: string) {
    localStorage.setItem('dev-dormitory', dormitoryId);
    window.location.reload();
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 right-4 z-[100] w-10 h-10 rounded-full bg-gray-800 text-white text-sm flex items-center justify-center shadow-lg opacity-60 hover:opacity-100 transition-opacity"
        aria-label="개발 패널 열기"
      >
        D
      </button>
    );
  }

  return (
    <div className="fixed bottom-28 right-4 z-[100] w-56 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-bold text-sm">Dev Panel</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
          aria-label="개발 패널 닫기"
        >
          X
        </button>
      </div>

      {/* 성별 전환 */}
      <div>
        <div className="text-gray-400 mb-1">성별</div>
        <div className="flex gap-2">
          {(['M', 'F'] as const).map((g) => (
            <button
              key={g}
              onClick={() => handleGenderChange(g)}
              className={`px-3 py-1 rounded ${
                currentGender === g
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {g === 'M' ? '남성' : '여성'}
            </button>
          ))}
        </div>
      </div>

      {/* 건물 전환 */}
      <div>
        <div className="text-gray-400 mb-1">건물</div>
        <select
          value={currentDormitory}
          onChange={(e) => handleDormitoryChange(e.target.value)}
          className="w-full bg-gray-700 text-white rounded px-2 py-1"
        >
          <option value="">선택 안함</option>
          <option value={UNASSIGNED_ID}>미배정</option>
          {DORMITORIES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.roomType}인실, {d.gender === 'BOTH' ? '혼성' : d.gender})
            </option>
          ))}
        </select>
      </div>

      <div className="text-gray-500 text-[10px]">변경 시 새로고침됩니다</div>
    </div>
  );
}
