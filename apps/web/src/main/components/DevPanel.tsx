'use client';

import { useEffect, useState } from 'react';
import { DORMITORIES, UNASSIGNED_ID } from '@/constants/dormitory';
import type { MockUser } from '@/__fixtures__/mock-db';

/**
 * 개발 환경 전용 플로팅 패널
 *
 * - 프리셋 유저(곰두리/봄이) 빠른 로그인
 * - 회원가입으로 생성된 유저 로그인
 * - 로그아웃 / 데이터 초기화
 * - 건물 전환
 *
 * production 빌드에서는 렌더링하지 않는다.
 */
export function DevPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<MockUser[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!isOpen) return;
    async function load() {
      const { mockDb } = await import('@/__fixtures__/mock-db');
      setCurrentUser(mockDb.getCurrentUser());
      setRegisteredUsers(mockDb.getRegisteredUsers());
    }
    load();
  }, [isOpen]);

  if (process.env.NODE_ENV !== 'development') return null;

  async function handlePresetLogin(key: 'male' | 'female') {
    const { PRESET_USERS } = await import('@/__fixtures__/mock-users');
    const { mockDb } = await import('@/__fixtures__/mock-db');
    const preset = PRESET_USERS[key];
    mockDb.setCurrentUser(preset);
    document.cookie = 'auth-token=mock-dev-token; path=/';
    window.location.href = '/';
  }

  async function handleUserLogin(user: MockUser) {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    mockDb.setCurrentUser(user);
    document.cookie = 'auth-token=mock-dev-token; path=/';
    window.location.href = '/';
  }

  async function handleLogout() {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    mockDb.setCurrentUser(null);
    document.cookie = 'auth-token=; path=/; max-age=0';
    window.location.href = '/';
  }

  async function handleClearAll() {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    mockDb.clearAll();
    document.cookie = 'auth-token=; path=/; max-age=0';
    window.location.href = '/';
  }

  function handleDormitoryChange(dormitoryId: string) {
    if (!currentUser) return;
    import('@/__fixtures__/mock-db').then(({ mockDb }) => {
      mockDb.updateUser(currentUser.email, { dormitoryId: dormitoryId || null });
      window.location.reload();
    });
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
    <div className="fixed bottom-28 right-4 z-[100] w-64 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 space-y-3 max-h-[70vh] overflow-y-auto">
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

      {/* 로그인 상태 */}
      <div className="bg-gray-800 rounded-lg p-2">
        <div className="text-gray-400 mb-1">로그인 상태</div>
        {currentUser ? (
          <div className="flex items-center justify-between">
            <span className="text-green-400 font-medium">
              {currentUser.nickname} ({currentUser.gender})
            </span>
            <button
              onClick={handleLogout}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <span className="text-gray-500">로그인 안됨</span>
        )}
      </div>

      {/* 프리셋 유저 */}
      <div>
        <div className="text-gray-400 mb-1">프리셋 로그인</div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePresetLogin('male')}
            className="flex-1 px-2 py-1.5 bg-blue-700 hover:bg-blue-600 rounded font-medium"
          >
            곰두리 (M)
          </button>
          <button
            onClick={() => handlePresetLogin('female')}
            className="flex-1 px-2 py-1.5 bg-pink-700 hover:bg-pink-600 rounded font-medium"
          >
            봄이 (F)
          </button>
        </div>
      </div>

      {/* 가입 유저 */}
      {registeredUsers.length > 0 && (
        <div>
          <div className="text-gray-400 mb-1">가입 유저</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {registeredUsers.map((u) => (
              <button
                key={u.email}
                onClick={() => handleUserLogin(u)}
                className="w-full text-left px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded truncate"
              >
                {u.nickname} ({u.gender}) — {u.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 건물 전환 (로그인 시만) */}
      {currentUser && (
        <div>
          <div className="text-gray-400 mb-1">건물</div>
          <select
            value={currentUser.dormitoryId ?? ''}
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
      )}

      {/* 데이터 초기화 */}
      <button
        onClick={handleClearAll}
        className="w-full px-2 py-1.5 bg-gray-700 hover:bg-red-800 rounded text-gray-400 hover:text-white transition-colors"
      >
        데이터 초기화
      </button>
    </div>
  );
}
